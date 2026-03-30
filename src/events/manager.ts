import { logger } from "@/logger";
import { env } from "@/lib/env";
import { getOrCreateSession, getSession, removeSession } from "./handlers/twitch.handler";

type SubscriptionKey = string; // `${integrationId}.${eventId}`

/**
 * EventManager is the central hub between widget WebSocket clients and external
 * provider event streams.
 *
 * It manages:
 *  - Reference counting per topic (integrationId.eventId)
 *  - 30-second grace period before disposing an idle provider connection
 *  - Routing incoming provider events to all interested client sockets
 *
 * Rules:
 *  - ONE outbound provider connection (e.g. Twitch EventSub WS) per integrationId.
 *  - Many widget sockets can subscribe to the same topic; the provider is called
 *    only when the first subscriber arrives (refcount 0 → 1).
 *  - When the last subscriber leaves, a 30s timer starts. If no one rejoins,
 *    the provider subscription is revoked.
 */
export class EventManager {
    private static instance: EventManager;

    /** topic → Set of raw Bun/Elysia ws handles */
    private sockets = new Map<SubscriptionKey, Set<any>>();

    /** topic → grace-period timer handle */
    private graceTimers = new Map<SubscriptionKey, ReturnType<typeof setTimeout>>();

    private constructor() { }

    public static getInstance(): EventManager {
        if (!EventManager.instance) EventManager.instance = new EventManager();
        return EventManager.instance;
    }

    // ─── Public API ──────────────────────────────────────────────────────────

    /**
     * Subscribe a widget socket to a provider event topic.
     *
     * @param ws         The client WebSocket handle (Elysia/Bun).
     * @param integration Full DB integration row (with tokens; server-side only).
     * @param eventId    Short event name, e.g. "channel.follow".
     */
    public subscribe(ws: any, integration: any, eventId: string) {
        const key = this.key(integration.id, eventId);

        if (!this.sockets.has(key)) this.sockets.set(key, new Set());
        const set = this.sockets.get(key)!;

        if (set.has(ws)) return; // already subscribed

        set.add(ws);
        const refCount = set.size;
        logger.info(`EventManager: +1 [${key}] → refCount: ${refCount}`);

        // Cancel any ongoing grace timer (a new subscriber arrived)
        if (this.graceTimers.has(key)) {
            clearTimeout(this.graceTimers.get(key)!);
            this.graceTimers.delete(key);
            logger.info(`EventManager: Grace timer cancelled for [${key}]`);
        }

        // Start provider connection on first subscriber
        if (refCount === 1) {
            this.startProvider(integration, eventId);
        }
    }

    /**
     * Unsubscribe a widget socket from a topic.
     * If this is the last subscriber, a 30s grace period begins.
     */
    public unsubscribe(ws: any, integrationId: string, eventId: string) {
        const key = this.key(integrationId, eventId);
        const set = this.sockets.get(key);
        if (!set || !set.has(ws)) return;

        set.delete(ws);
        const remaining = set.size;
        logger.info(`EventManager: -1 [${key}] → remaining: ${remaining}`);

        if (remaining === 0) {
            this.beginGracePeriod(integrationId, eventId);
        }
    }

    /**
     * Remove a socket from ALL topics it was subscribed to (called on disconnect).
     */
    public unsubscribeAll(ws: any) {
        for (const [key, set] of this.sockets.entries()) {
            if (!set.has(ws)) continue;
            const dotIndex = key.indexOf(".");
            if (dotIndex === -1) continue;
            const integrationId = key.slice(0, dotIndex);
            const eventId = key.slice(dotIndex + 1);
            this.unsubscribe(ws, integrationId, eventId);
        }
    }

    /**
     * Deliver an event received from a provider to all subscribed widget sockets.
     * Called by the provider handler (e.g. TwitchSession) — never by clients.
     */
    public emit(integrationId: string, eventId: string, data: any) {
        const key = this.key(integrationId, eventId);
        const set = this.sockets.get(key);
        if (!set || set.size === 0) return;

        const payload = JSON.stringify({
            event: "integration:event",
            data: { integrationId, eventId, event: data },
        });

        for (const ws of set) {
            try {
                ws.send(payload);
            } catch {
                // stale socket — will be cleaned up on its close event
            }
        }
    }

    // ─── Private helpers ─────────────────────────────────────────────────────

    private key(integrationId: string, eventId: string): SubscriptionKey {
        return `${integrationId}.${eventId}`;
    }

    /**
     * Start or update the outbound provider connection for the given integration.
     * Currently supports: twitch
     */
    private startProvider(integration: any, eventId: string) {
        const { provider, id: integrationId, providerUserId, accessToken, refreshToken } = integration;

        logger.info(`EventManager: startProvider [${provider}] integration=${integrationId} event=${eventId}`);

        if (provider === "twitch") {
            if (!env.TWITCH_CLIENT_ID) {
                logger.error("EventManager: TWITCH_CLIENT_ID is not configured.");
                return;
            }
            const session = getOrCreateSession({
                integrationId,
                clientId: env.TWITCH_CLIENT_ID,
                refreshToken,                        // Session handles the token exchange
                channelId: providerUserId,           // Always from DB — never from client
                emit: (evtId, data) => this.emit(integrationId, evtId, data),
            });
            session.addEvent(eventId);
        }
        // else if (provider === "kick") { ... }
    }

    /**
     * Begins a 30-second grace period before tearing down the provider subscription.
     */
    private beginGracePeriod(integrationId: string, eventId: string) {
        const key = this.key(integrationId, eventId);
        if (this.graceTimers.has(key)) return;

        logger.info(`EventManager: Grace period started for [${key}]`);

        const timer = setTimeout(() => {
            const set = this.sockets.get(key);
            if (!set || set.size === 0) {
                logger.info(`EventManager: Grace period expired for [${key}]. Disposing.`);
                this.disposeProvider(integrationId, eventId);
                this.sockets.delete(key);
            }
            this.graceTimers.delete(key);
        }, 30_000);

        this.graceTimers.set(key, timer);
    }

    /**
     * Revokes the provider-side subscription and removes the session from
     * memory if it has no more events.
     */
    private disposeProvider(integrationId: string, eventId: string) {
        // Twitch
        const session = getSession(integrationId);
        if (session) {
            session.removeEvent(eventId);
            if (session.eventCount === 0) {
                removeSession(integrationId);
            }
        }
    }
}

export const eventManager = EventManager.getInstance();
