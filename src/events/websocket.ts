import { Elysia, t } from "elysia";
import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/database";
import { widgets, integrations, users } from "@/database/schema";
import { logger } from "@/logger";

export interface WebSocketData {
    widgetId: string;
    userId: string;
    integrations: string[];
    widget: any;
}

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
            let widgetIntegrations: string[] = [];
            const integrationIds = widget.integrations as string[];
            if (integrationIds && integrationIds.length > 0) {
                const userIntegrations = await db
                    .select()
                    .from(integrations)
                    .where(
                        and(
                            eq(integrations.userId, widget.userId),
                            inArray(integrations.id, integrationIds)
                        )
                    );

                widgetIntegrations = userIntegrations.map(i => i.provider);
            }

            return {
                widgetId: widget.id,
                userId: user.id,
                integrations: widgetIntegrations,
                widget: {
                    id: widget.id,
                    appId: widget.appId,
                    displayName: widget.displayName,
                    settings: widget.settings,
                    integrations: widget.integrations,
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
            for (const provider of integrations) {
                ws.subscribe(`user:${userId}:${provider}`);
            }

            // Emit initial data to the client
            ws.send({
                event: "widget:data",
                data: widget,
            });
        },

        message(ws, message) {
            // Placeholder for basic interactive commands
            if (message === "ping") {
                ws.send({ event: "pong", timestamp: Date.now() });
            }
        },

        close(ws) {
            const data = ws.data as unknown as WebSocketData;
            if (data?.widgetId) {
                logger.debug(`WebSocket disconnected: Widget ${data.widgetId}`);

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
