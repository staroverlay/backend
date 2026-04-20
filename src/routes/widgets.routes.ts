import Elysia, { t } from "elysia";

import { requireVerified } from "@/middlewares/auth";
import { handleServiceError } from "@/lib/request-helpers";
import {
    createWidget,
    listUserWidgets,
    getWidget,
    rotateWidgetToken,
    updateWidgetMeta,
    updateWidgetSettings,
    deleteWidget,
} from "@/services/widgets.service";

export const widgetsRoutes = new Elysia({ prefix: "/widgets" })
    .use(requireVerified)

    // List widgets installed by the authenticated user
    .get("/", async ({ user }) => {
        const widgets = await listUserWidgets(user!.profile.id);
        return { widgets };
    })

    // Get a specific widget by ID
    .get("/:id", async ({ user, params, set }) => {
        try {
            const widget = await getWidget(user!.profile.id, params.id);
            return { widget };
        } catch (e) {
            return handleServiceError(e, set);
        }
    }, {
        params: t.Object({ id: t.String() })
    })

    // Create widget instance from app id + integration UUIDs
    .post(
        "/",
        async ({ user, body, set }) => {
            try {
                const widget = await createWidget(user!.profile.id, {
                    app_id: body.app_id,
                    integration_ids: body.integration_ids,
                    display_name: body.display_name,
                });
                return { success: true, widget };
            } catch (e) {
                return handleServiceError(e, set);
            }
        },
        {
            body: t.Object({
                app_id: t.String({ minLength: 1 }),
                integration_ids: t.Array(t.String({ minLength: 1 })),
                display_name: t.Optional(t.String({ minLength: 1 })),
            }),
        }
    )

    // Update widget instance metadata (display_name, integration_ids, enabled)
    .patch(
        "/:id",
        async ({ user, params, body, set }) => {
            try {
                const widget = await updateWidgetMeta(user!.profile.id, params.id, {
                    display_name: body.display_name,
                    integration_ids: body.integration_ids,
                    enabled: body.enabled,
                });
                return { success: true, widget };
            } catch (e) {
                return handleServiceError(e, set);
            }
        },
        {
            params: t.Object({ id: t.String() }),
            body: t.Object({
                display_name: t.Optional(t.String({ minLength: 1 })),
                integration_ids: t.Optional(t.Array(t.String({ minLength: 1 }))),
                enabled: t.Optional(t.Boolean()),
            }),
        }
    )

    // Update widget settings with validation based on the app.json schema
    .patch(
        "/:id/settings",
        async ({ user, params, body, set }) => {
            try {
                const widget = await updateWidgetSettings(
                    user!.profile.id,
                    params.id,
                    body as Record<string, unknown>
                );
                return { success: true, widget };
            } catch (e) {
                return handleServiceError(e, set);
            }
        },
        {
            params: t.Object({ id: t.String() }),
            body: t.Record(t.String(), t.Any()),
        }
    )

    // Rotate widget token
    .post(
        "/:id/token/rotate",
        async ({ user, params, set }) => {
            try {
                const result = await rotateWidgetToken(user!.profile.id, params.id);
                return { success: true, ...result };
            } catch (e) {
                return handleServiceError(e, set);
            }
        },
        {
            params: t.Object({ id: t.String() }),
        }
    )

    // Delete widget instance
    .delete(
        "/:id",
        async ({ user, params, set }) => {
            try {
                await deleteWidget(user!.profile.id, params.id);
                return { success: true };
            } catch (e) {
                return handleServiceError(e, set);
            }
        },
        {
            params: t.Object({ id: t.String() }),
        }
    );
