import { Elysia, t } from "elysia";
import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/database";
import { widgets, integrations, users } from "@/database/schema";
import { getAccessToken } from "@/services/token-manager.service";
import { env } from "@/lib/env";

export const internalRoutes = new Elysia({ prefix: "/internal" })
    .guard({
        beforeHandle({ headers, set }) {
            const authHeader = headers.authorization;
            if (!authHeader || !authHeader.startsWith("Bearer ")) {
                set.status = 401;
                return { error: "Missing or invalid Authorization header" };
            }

            const token = authHeader.split(" ")[1];
            if (token !== env.INTERNAL_SECRET) {
                set.status = 403;
                return { error: "Forbidden: Invalid internal secret" };
            }
        }
    })
    .get(
        "/widget",
        async ({ query, set }) => {
            const { token } = query;

            // 1. Load widget
            const [widget] = await db
                .select()
                .from(widgets)
                .where(eq(widgets.token, token))
                .limit(1);

            if (!widget) {
                set.status = 404;
                return { error: "Widget not found" };
            }

            if (!widget.enabled) {
                set.status = 403;
                return { error: "Widget is disabled" };
            }

            // 2. Load user to verify it exists
            const [user] = await db
                .select({ id: users.id })
                .from(users)
                .where(eq(users.id, widget.userId))
                .limit(1);

            if (!user) {
                set.status = 404;
                return { error: "Widget owner not found" };
            }

            // 3. Load integrations
            const widgetIntegrations = widget.integrations as string[];
            let finalIntegrations: any[] = [];

            if (widgetIntegrations && widgetIntegrations.length > 0) {
                // Fetch all user integrations to filter by composite ID
                const allIntegrations = await db
                    .select()
                    .from(integrations)
                    .where(eq(integrations.userId, widget.userId));

                const results = allIntegrations.filter(i =>
                    widgetIntegrations.includes(`${i.provider}:${i.userId}:${i.providerUserId}`)
                );

                // Process each integration to fetch valid access token
                finalIntegrations = await Promise.all(
                    results.map(async (i) => {
                        let token = null;
                        try {
                            token = await getAccessToken(i.id);
                        } catch (error: any) {
                            console.error(`[Internal] Failed to get access token for integration ${i.id}:`, error.message);
                        }

                        const compositeId = `${i.provider}:${i.userId}:${i.providerUserId}`;
                        return {
                            id: compositeId,
                            public: {
                                id: i.id,
                                provider: i.provider,
                                providerUsername: i.providerUsername,
                                providerUserId: i.providerUserId,
                                providerAvatarUrl: i.providerAvatarUrl
                            },
                            access_token: token,
                        };
                    })
                );
            }

            return {
                widget: {
                    id: widget.id,
                    userId: widget.userId,
                    appId: widget.appId,
                    displayName: widget.displayName,
                    settings: widget.settings,
                    createdAt: widget.createdAt,
                    updatedAt: widget.updatedAt,
                    enabled: widget.enabled,
                },
                integrations: finalIntegrations,
            };
        },
        {
            query: t.Object({
                token: t.String({ minLength: 1 }),
            })
        }
    );
