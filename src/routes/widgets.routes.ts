import Elysia, { t } from "elysia";

import { requireVerified } from "@/middlewares/auth";
import { handleServiceError } from "@/lib/request-helpers";
import {
    createWidget,
    listUserWidgets,
    rotateWidgetToken,
    updateWidgetMeta,
    updateWidgetSettings,
} from "@/services/widgets.service";

export const widgetsRoutes = new Elysia({ prefix: "/widgets" })
    .use(requireVerified)

    // List widgets installed by the authenticated user
    .get("/", async ({ user }) => {
        const widgets = await listUserWidgets(user!.id);
        return { widgets };
    })

    // Create widget instance from app id + integrations
    .post(
        "/",
        async ({ user, body, set }) => {
            try {
                const widget = await createWidget(user!.id, body);
                return { success: true, widget };
            } catch (e) {
                return handleServiceError(e, set);
            }
        },
        {
            body: t.Object({
                app_id: t.String({ minLength: 1 }),
                integrations: t.Array(t.String({ minLength: 1 })),
            }),
        }
    )

    // Update widget instance metadata (display_name, integrations, enabled)
    .patch(
        "/:id",
        async ({ user, params, body, set }) => {
            try {
                const widget = await updateWidgetMeta(user!.id, params.id, body);
                return { success: true, widget };
            } catch (e) {
                return handleServiceError(e, set);
            }
        },
        {
            params: t.Object({ id: t.String() }),
            body: t.Object({
                display_name: t.Optional(t.String({ minLength: 1 })),
                integrations: t.Optional(t.Array(t.String({ minLength: 1 }))),
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
                    user!.id,
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
                const result = await rotateWidgetToken(user!.id, params.id);
                return { success: true, ...result };
            } catch (e) {
                return handleServiceError(e, set);
            }
        },
        {
            params: t.Object({ id: t.String() }),
        }
    );

