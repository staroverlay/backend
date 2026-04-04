import { Elysia, t } from "elysia";
import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/database";
import { widgets, integrations, users } from "@/database/schema";
import { logger } from "@/logger";

export interface WebSocketData {
    widgetId: string;
    userId: string;
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

            // Get user information
            const [user] = await db
                .select()
                .from(users)
                .where(eq(users.id, widget.userId))
                .limit(1);

            if (!user) {
                set.status = 401;
                throw new Error("User not found");
            }

            // Get connected integrations for this widget
            let detailedIntegrations: Array<{
                id: string;
                type: string;
                username: string;
                avatarURL: string | null;
            }> = [];
            let integrationIds: string[] = [];
            let userIntegrations: any[] = [];

            const ids = widget.integrations as string[];
            if (ids && ids.length > 0) {
                // Fetch all user integrations to filter by composite ID
                const allUserIntegrations = await db
                    .select()
                    .from(integrations)
                    .where(eq(integrations.userId, widget.userId));

                userIntegrations = allUserIntegrations.filter(i =>
                    ids.includes(`${i.provider}:${i.userId}:${i.providerUserId}`)
                );

                detailedIntegrations = userIntegrations.map(i => ({
                    id: `${i.provider}:${i.userId}:${i.providerUserId}`,
                    type: i.provider,
                    username: i.providerUsername,
                    avatarURL: i.providerAvatarUrl,
                }));
                integrationIds = detailedIntegrations.map(i => i.id);
            }

            return {
                widgetId: widget.id,
                userId: user.id,
                integrationIds,
                integrations: detailedIntegrations,
                fullIntegrations: userIntegrations,
                widget: {
                    id: widget.id,
                    appId: widget.appId,
                    displayName: widget.displayName,
                    settings: widget.settings,
                    integrations: detailedIntegrations, // Send detailed (sanitized) ones to client
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
            const { widgetId, userId, integrations, widget } = data;

            logger.info(`WebSocket connected: Widget ${widgetId} (User ID: ${userId})`);

            // Add to manual tracking map
            if (!widgetSockets.has(widgetId)) {
                widgetSockets.set(widgetId, new Set());
            }
            widgetSockets.get(widgetId)!.add(ws);

            // Join rooms using native subscribe
            // These can be used for server-side broadcasts
            ws.subscribe(`widget:${widgetId}`);
            ws.subscribe(`user:${userId}`);

            // Also subscribe to specific integrations if needed
            for (const integration of integrations) {
                ws.subscribe(`user:${userId}:${integration.type}`);
            }

            // Emit initial data to the client
            ws.send({
                event: "widget:data",
                data: widget,
            });
        },

        message(ws, rawMessage) {
            const data = ws.data as unknown as WebSocketData;

            // Handle JSON messages
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
                        `${i.provider}:${i.userId}:${i.providerUserId}` === integrationId
                    );

                    if (!fullIntegration) {
                        logger.warn(`Security: User ${data.userId} attempted to subscribe to unknown integration ${integrationId}`);
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
                // If not JSON, handle as raw commands
                if (rawMessage === "ping") {
                    ws.send({ event: "pong", timestamp: Date.now() });
                }
            }
        },

        close(ws) {
            const data = ws.data as unknown as WebSocketData;
            if (data?.widgetId) {
                logger.debug(`WebSocket disconnected: Widget ${data.widgetId}`);

                // Unsubscribe from all event subscriptions
                eventManager.unsubscribeAll(ws);

                // Remove from manual tracking map
                const sockets = widgetSockets.get(data.widgetId);
                if (sockets) {
                    sockets.delete(ws);
                    if (sockets.size === 0) {
                        widgetSockets.delete(data.widgetId);
                    }
                }
            }
            // Clear socket data as requested
            ws.data = {} as any;
        },
    });
