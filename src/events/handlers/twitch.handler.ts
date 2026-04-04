import { logger } from "@/logger";

import { TWITCH_EVENT_MAP } from "./twitch.events";
import { getAccessToken } from "../../services/token-manager.service";
import { TWITCH_EVENTSUB_WS_URL, twitchApiService } from "../../apis/twitch/service";

/** Emitter function injected by the EventManager to push data to widgets */
export type EmitFn = (eventId: string, data: any) => void;

//

/**
 * TwitchSession manages ONE outbound WebSocket connection to Twitch EventSub
 * for a specific integration (user account).
 *
 * Multiple internal widgets/clients may subscribe to topics through this single
 * session — no duplicate Twitch connections are created for the same account.
 *
 * Lifecycle:
 *   1. Created by the pool when the first subscriber appears.
 *   2. Refreshes the access token from the refresh token before connecting.
 *   3. Each new event topic is registered via `addEvent(eventId)`.
 *   4. Each removed event topic is unregistered via `removeEvent(eventId)`.
 *   5. When no events remain and the grace period expires, `dispose()` is called.
 */
export class TwitchSession {
    private ws: WebSocket | null = null;
    private sessionId: string | null = null;

    private clientId: string;
    private accessToken: string = "";   // resolved after token refresh
    private refreshToken: string;
    private channelId: string;          // providerUserId — always from DB, never from client
    private integrationId: string;
    private emit: EmitFn;

    /** eventId → Twitch subscription ID returned by the API */
    private activeSubscriptions = new Map<string, string>();

    /** eventIds waiting for the WS sessionId OR the token refresh to finish */
    private pendingEvents = new Set<string>();

    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private disposed = false;
    private ready = false; // true once the first token refresh succeeds

    constructor(opts: {
        integrationId: string;
        clientId: string;
        refreshToken: string;
        channelId: string;
        emit: EmitFn;
    }) {
        this.integrationId = opts.integrationId;
        this.clientId = opts.clientId;
        this.refreshToken = opts.refreshToken;
        this.channelId = opts.channelId;
        this.emit = opts.emit;
        this.initialize();
    }

    //  Public API

    /** Queue a new eventId. Safe to call before the session is ready. */
    public addEvent(eventId: string) {
        if (this.activeSubscriptions.has(eventId) || this.pendingEvents.has(eventId)) return;
        logger.info(`[Twitch:${this.integrationId}] Queuing event "${eventId}"`);
        this.pendingEvents.add(eventId);
        if (this.ready && this.sessionId) {
            this.registerPending();
        }
    }

    /** Manually inject an event (e.g. from Twitch CLI) to treat it as a real EventSub push. */
    public debugEvent(payload: any) {
        // Many webhooks (Twitch CLI) send subscription and event directly.
        // We simulate a WS notification.
        const simulatedMsg = {
            metadata: {
                message_type: "notification"
            },
            payload: payload
        };
        this.handleMessage(simulatedMsg);
    }

    /** Revoke a single EventSub subscription and remove it from tracking. */
    public async removeEvent(eventId: string) {
        this.pendingEvents.delete(eventId);
        const subId = this.activeSubscriptions.get(eventId);
        if (!subId) return;

        this.activeSubscriptions.delete(eventId);
        logger.info(`[Twitch:${this.integrationId}] Revoking "${eventId}" (subId: ${subId})`);

        try {
            await twitchApiService.revokeSubscription(this.accessToken, this.clientId, subId);
        } catch (err) {
            logger.warn(`[Twitch:${this.integrationId}] Failed to revoke subscription: ${err}`);
        }
    }

    /** Total number of active + pending events. */
    public get eventCount() {
        return this.activeSubscriptions.size + this.pendingEvents.size;
    }

    /** Tear down everything. */
    public dispose() {
        this.disposed = true;
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        if (this.ws) {
            this.ws.onclose = null; // prevent auto-reconnect loop
            this.ws.close();
        }
        this.activeSubscriptions.clear();
        this.pendingEvents.clear();
        logger.warn(`[Twitch:${this.integrationId}] Session disposed.`);
    }

    //  Private — initialization 

    /**
     * First step: refresh the access token, then open the WS connection.
     * Any `addEvent` calls before this finishes land in `pendingEvents`.
     */
    private async initialize() {
        try {
            logger.info(`[Twitch:${this.integrationId}] Fetching/Refreshing access token...`);
            this.accessToken = await getAccessToken(this.integrationId);
            this.ready = true;
            this.connect();
        } catch (err) {
            logger.error(`[Twitch:${this.integrationId}] Token refresh failed: ${err}`);
            // Retry in 30 seconds
            if (!this.disposed) {
                this.reconnectTimer = setTimeout(() => this.initialize(), 30_000);
            }
        }
    }

    //  Private — connection management 

    private connect() {
        if (this.disposed) return;
        logger.info(`[Twitch:${this.integrationId}] Connecting to EventSub WebSocket...`);

        const ws = new WebSocket(TWITCH_EVENTSUB_WS_URL);
        this.ws = ws;

        ws.onopen = () => {
            logger.info(`[Twitch:${this.integrationId}] WS connection opened.`);
        };

        ws.onmessage = (ev) => {
            try {
                this.handleMessage(JSON.parse(ev.data as string));
            } catch (err) {
                logger.error(`[Twitch:${this.integrationId}] Failed to parse WS message: ${err}`);
            }
        };

        ws.onerror = (ev) => {
            logger.error(`[Twitch:${this.integrationId}] WS error: ${ev}`);
        };

        ws.onclose = () => {
            if (this.disposed) return;
            this.sessionId = null;
            logger.warn(`[Twitch:${this.integrationId}] Disconnected. Reconnecting in 5s...`);
            this.reconnectTimer = setTimeout(() => this.connect(), 5_000);
        };
    }

    private handleMessage(msg: any) {
        const msgType: string = msg?.metadata?.message_type;

        switch (msgType) {
            case "session_welcome": {
                this.sessionId = msg.payload?.session?.id;
                logger.info(`[Twitch:${this.integrationId}] Session ready: ${this.sessionId}`);
                this.registerPending();
                break;
            }

            case "session_reconnect": {
                // Twitch asks us to move to a new URL without dropping events
                const newUrl: string = msg.payload?.session?.reconnect_url;
                if (!newUrl || !newUrl.startsWith("wss://eventsub.wss.twitch.tv/")) {
                    logger.error(`[Twitch:${this.integrationId}] Malicious or invalid reconnect URL: ${newUrl}`);
                    return;
                }
                logger.warn(`[Twitch:${this.integrationId}] Reconnect → ${newUrl}`);
                // Move active subs back to pending so they re-register on the new session
                for (const [eventId] of this.activeSubscriptions) {
                    this.pendingEvents.add(eventId);
                }
                this.activeSubscriptions.clear();
                this.sessionId = null;
                const oldWs = this.ws!;
                const newWs = new WebSocket(newUrl);
                this.ws = newWs;
                newWs.onopen = oldWs.onopen;
                newWs.onmessage = oldWs.onmessage;
                newWs.onerror = oldWs.onerror;
                newWs.onclose = oldWs.onclose;
                // Close old connection only after new one is open
                newWs.addEventListener("open", () => oldWs.close());
                break;
            }

            case "notification": {
                const eventType: string = msg?.payload?.subscription?.type;
                const eventData = msg?.payload?.event;
                const eventId = Object.entries(TWITCH_EVENT_MAP).find(
                    ([, def]) => def.type === eventType
                )?.[0];
                if (eventId && eventData) {
                    this.emit(eventId, eventData);
                }
                break;
            }

            case "revocation": {
                const subId = msg?.payload?.subscription?.id;
                const reason = msg?.payload?.subscription?.status;
                logger.warn(`[Twitch:${this.integrationId}] Subscription revoked: ${subId} (${reason})`);
                for (const [evtId, sid] of this.activeSubscriptions) {
                    if (sid === subId) { this.activeSubscriptions.delete(evtId); break; }
                }
                break;
            }

            case "session_keepalive":
                break;

            default:
                logger.debug(`[Twitch:${this.integrationId}] Unknown message type: ${msgType}`);
        }
    }

    private async registerPending() {
        if (!this.sessionId) return;
        const toRegister = [...this.pendingEvents];
        this.pendingEvents.clear();
        for (const eventId of toRegister) {
            await this.registerSubscription(eventId);
        }
    }

    private async registerSubscription(eventId: string): Promise<void> {
        const def = TWITCH_EVENT_MAP[eventId];
        if (!def) {
            logger.warn(`[Twitch:${this.integrationId}] Unknown event "${eventId}" — skipping.`);
            return;
        }

        const subId = await twitchApiService.registerSubscription({
            accessToken: this.accessToken,
            clientId: this.clientId,
            sessionId: this.sessionId!,
            channelId: this.channelId,
            subType: def.type,
            version: def.version,
            condition: def.condition,
        });

        if (subId) {
            this.activeSubscriptions.set(eventId, subId);
            logger.info(`[Twitch:${this.integrationId}] Registered "${eventId}" → subId: ${subId}`);
        }
    }

    private authHeaders() {
        return {
            "Authorization": `Bearer ${this.accessToken}`,
            "Client-Id": this.clientId,
        };
    }
}

//
// Pool — one TwitchSession per integrationId
//

const pool = new Map<string, TwitchSession>();

export const getOrCreateSession = (opts: {
    integrationId: string;
    clientId: string;
    refreshToken: string;
    channelId: string;
    emit: EmitFn;
}): TwitchSession => {
    if (!pool.has(opts.integrationId)) {
        pool.set(opts.integrationId, new TwitchSession(opts));
    }
    return pool.get(opts.integrationId)!;
};

export const getSession = (integrationId: string) => pool.get(integrationId);

export const removeSession = (integrationId: string) => {
    const session = pool.get(integrationId);
    if (session) {
        session.dispose();
        pool.delete(integrationId);
    }
};
