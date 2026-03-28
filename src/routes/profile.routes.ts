import Elysia, { t } from "elysia";

import { requireVerified } from "@/middlewares/auth";
import {
    getProfile,
    upsertProfile,
    deleteProfile,
} from "@/services/profile.service";
import { handleServiceError } from "@/lib/request-helpers";

export const profileRoutes = new Elysia({ prefix: "/profile" })
    .use(requireVerified)

    .get("/", async ({ user, set }) => {
        try {
            return await getProfile(user.id);
        } catch (e) {
            return handleServiceError(e, set);
        }
    })

    .put(
        "/",
        async ({ user, body, set }) => {
            try {
                const result = await upsertProfile(user.id, body.displayName);
                return { success: true, ...result };
            } catch (e) {
                return handleServiceError(e, set);
            }
        },
        {
            body: t.Object({
                displayName: t.String({ minLength: 1, maxLength: 64 }),
            }),
        }
    )

    .delete("/", async ({ user, set }) => {
        try {
            await deleteProfile(user.id);
            return { success: true, message: "Profile deleted" };
        } catch (e) {
            return handleServiceError(e, set);
        }
    });
