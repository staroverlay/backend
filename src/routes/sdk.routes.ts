import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";

import { db } from "@/database";
import { widgets, widgetIntegrations, integrations } from "@/database/schema";

/**
 * Public SDK Routes
 * These endpoints are used directly by the widgets (via the SDK) 
 * and are authenticated by the widget's unique static token.
 */
export const sdkRoutes = new Elysia({ prefix: "/sdk" })
    .get(
        "/widget-config",
        async ({ query, set }) => {
            const { token } = query;

            // 1. Load widget by static token
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

            // 2. Load integrations via junction table (only public data)
            const widgetIntegrationRows = await db
                .select({
                    id: integrations.id,
                    provider: integrations.provider,
                    providerUsername: integrations.providerUsername,
                    providerUserId: integrations.providerUserId,
                    providerAvatarUrl: integrations.providerAvatarUrl,
                    profileId: integrations.profileId,
                })
                .from(widgetIntegrations)
                .innerJoin(integrations, eq(widgetIntegrations.integrationId, integrations.id))
                .where(eq(widgetIntegrations.widgetId, widget.id));

            const finalIntegrations = widgetIntegrationRows.map((i) => {
                const compositeId = `${i.provider}:${i.profileId}:${i.providerUserId}`;
                return {
                    id: compositeId,
                    provider: i.provider,
                    providerUsername: i.providerUsername,
                    providerUserId: i.providerUserId,
                    providerAvatarUrl: i.providerAvatarUrl,
                };
            });

            // 3. Return simplified widget object
            return {
                widget: {
                    id: widget.id,
                    appId: widget.appId,
                    displayName: widget.displayName,
                    settings: widget.settings,
                    enabled: widget.enabled,
                    createdAt: widget.createdAt,
                    updatedAt: widget.updatedAt,
                },
                integrations: finalIntegrations,
            };
        },
        {
            query: t.Object({
                token: t.String({ minLength: 1 }),
            }),
        }
    );
