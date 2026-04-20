import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";

import { db } from "@/database";
import { widgets, widgetIntegrations, integrations } from "@/database/schema";
import { logger } from "@/logger";

export interface WebSocketData {
    widgetId: string;
    profileId: string;
    integrationIds: string[];
    integrations: Array<{
        id: string;
        type: string;
        username: string;
        avatarURL: string | null;
    }>;
    fullIntegrations: any[];
    widget: any;
}

import { eventManager } from "./manager";

let appInstance: any = null;
const widgetSockets = new Map<string, Set<any>>();

export const setAppInstance = (app: any) => {
    appInstance = app;
};

/**
 * Broadcasts an event to all connected sockets of a specific widget
 */
export const emitToWidget = (widgetId: string, event: string, data: any) => {
    const sockets = widgetSockets.get(widgetId);
    if (sockets && sockets.size > 0) {
        const payload = JSON.stringify({ event, data });
        for (const ws of sockets) {
            try {
                ws.send(payload);
            } catch (err) {
                logger.error(`Failed to send message to socket for widget ${widgetId}: ${err}`);
            }
        }
    } else {
        // Fallback to pub/sub if initialized
        if (appInstance?.server) {
            appInstance.server.publish(`widget:${widgetId}`, JSON.stringify({ event, data }));
        }
    }
};

export const websocketPlugin = new Elysia({ prefix: "/events" })
    .resolve(async ({ query, set }) => {
        const { token } = query;

        if (!token) {
            set.status = 401;
            throw new Error("Missing token");
        }

        try {
            // Find widget by token
            const [widget] = await db
                .select()
                .from(widgets)
                .where(eq(widgets.token, token))
                .limit(1);

            if (!widget) {
                set.status = 401;
                throw new Error("Invalid token");
            }

            if (!widget.enabled) {
                set.status = 401;
                throw new Error("Widget is disabled");
            }

            // Load integrations via junction table
            const widgetIntegrationRows = await db
                .select({
                    integrationId: widgetIntegrations.integrationId,
                    provider: integrations.provider,
                    providerUsername: integrations.providerUsername,
                    providerUserId: integrations.providerUserId,
                    providerAvatarUrl: integrations.providerAvatarUrl,
                    profileId: integrations.profileId,
                    accessToken: integrations.accessToken,
                    refreshToken: integrations.refreshToken,
                    tokenExpiresAt: integrations.tokenExpiresAt,
                })
                .from(widgetIntegrations)
                .innerJoin(integrations, eq(widgetIntegrations.integrationId, integrations.id))
                .where(eq(widgetIntegrations.widgetId, widget.id));

            const detailedIntegrations = widgetIntegrationRows.map(i => ({
                id: `${i.provider}:${i.profileId}:${i.providerUserId}`,
                type: i.provider,
                username: i.providerUsername,
                avatarURL: i.providerAvatarUrl,
            }));

            const integrationIds = detailedIntegrations.map(i => i.id);

            return {
                widgetId: widget.id,
                profileId: widget.profileId,
                integrationIds,
                integrations: detailedIntegrations,
                fullIntegrations: widgetIntegrationRows,
                widget: {
                    id: widget.id,
                    appId: widget.appId,
                    displayName: widget.displayName,
                    settings: widget.settings,
                    integrations: detailedIntegrations,
                    createdAt: widget.createdAt,
                    updatedAt: widget.updatedAt,
                    enabled: widget.enabled,
                },
            };
        } catch (error: any) {
            logger.error(`WebSocket authentication error: ${error.message}`);
            set.status = set.status === 200 ? 500 : set.status;
            throw error;
        }
    })
    .ws("/widget", {
        query: t.Object({
            token: t.String({ minLength: 1 }),
        }),

        open(ws) {
            const data = ws.data as unknown as WebSocketData;
            const { widgetId, profileId, integrations, widget } = data;

            logger.info(`WebSocket connected: Widget ${widgetId} (Profile ID: ${profileId})`);

            // Add to manual tracking map
            if (!widgetSockets.has(widgetId)) {
                widgetSockets.set(widgetId, new Set());
            }
            widgetSockets.get(widgetId)!.add(ws);

            // Join rooms using native subscribe
            ws.subscribe(`widget:${widgetId}`);
            ws.subscribe(`profile:${profileId}`);

            // Subscribe to specific integration channels
            for (const integration of integrations) {
                ws.subscribe(`profile:${profileId}:${integration.type}`);
            }

            // Emit initial data to the client
            ws.send({
                event: "widget:data",
                data: widget,
            });
        },

        message(ws, rawMessage) {
            const data = ws.data as unknown as WebSocketData;

            try {
                const message = typeof rawMessage === "string" ? JSON.parse(rawMessage) : rawMessage;
                const { event, data: payload } = message;

                if (event === "ping") {
                    ws.send({ event: "pong", timestamp: Date.now() });
                    return;
                }

                if (event === "subscribe") {
                    const { integrationId, eventId } = payload || {};
                    if (!integrationId || !eventId) return;

                    // Find the full integration record (server-side only, never exposed to client)
                    const fullIntegration = data.fullIntegrations?.find((i: any) =>
                        `${i.provider}:${i.profileId}:${i.providerUserId}` === integrationId
                    );

                    if (!fullIntegration) {
                        logger.warn(`Security: Profile ${data.profileId} attempted to subscribe to unknown integration ${integrationId}`);
                        return;
                    }

                    eventManager.subscribe(ws, fullIntegration, eventId);
                    return;
                }

                if (event === "unsubscribe") {
                    const { integrationId, eventId } = payload || {};
                    if (!integrationId || !eventId) return;
                    eventManager.unsubscribe(ws, integrationId, eventId);
                    return;
                }

            } catch (err) {
                if (rawMessage === "ping") {
                    ws.send({ event: "pong", timestamp: Date.now() });
                }
            }
        },

        close(ws) {
            const data = ws.data as unknown as WebSocketData;
            if (data?.widgetId) {
                logger.debug(`WebSocket disconnected: Widget ${data.widgetId}`);

                eventManager.unsubscribeAll(ws);

                const sockets = widgetSockets.get(data.widgetId);
                if (sockets) {
                    sockets.delete(ws);
                    if (sockets.size === 0) {
                        widgetSockets.delete(data.widgetId);
                    }
                }
            }
            ws.data = {} as any;
        },
    });
