import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";

import { db } from "@/database";
import { widgets, widgetIntegrations, integrations, profiles } from "@/database/schema";
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

            // 2. Load profile to verify it exists
            const [profile] = await db
                .select({ id: profiles.id })
                .from(profiles)
                .where(eq(profiles.id, widget.profileId))
                .limit(1);

            if (!profile) {
                set.status = 404;
                return { error: "Widget owner profile not found" };
            }

            // 3. Load integrations via junction table
            const widgetIntegrationRows = await db
                .select({
                    integrationId: widgetIntegrations.integrationId,
                    provider: integrations.provider,
                    providerUsername: integrations.providerUsername,
                    providerUserId: integrations.providerUserId,
                    providerAvatarUrl: integrations.providerAvatarUrl,
                    profileId: integrations.profileId,
                })
                .from(widgetIntegrations)
                .innerJoin(integrations, eq(widgetIntegrations.integrationId, integrations.id))
                .where(eq(widgetIntegrations.widgetId, widget.id));

            // 4. Map integrations to public information (no tokens)
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

            return {
                widget: {
                    id: widget.id,
                    profileId: widget.profileId,
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
