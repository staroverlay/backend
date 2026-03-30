import Elysia, { t } from "elysia";

import { authMiddleware } from "@/middlewares/auth";
import {
    listActiveSessions,
    revokeSession,
} from "@/services/sessions.service";
import { handleServiceError } from "@/lib/request-helpers";

export const sessionsRoutes = new Elysia({ prefix: "/sessions" })
    .use(authMiddleware)

    // List active sessions
    .get("/", async ({ user, session: currentSession }) => {
        const sessions = await listActiveSessions(user!.id, currentSession!.id);
        return { sessions };
    })

    // Revoke a specific session
    .delete(
        "/:id",
        async ({ user, params, set }) => {
            try {
                const isCurrent = await revokeSession(user!.id, params.id);
                return {
                    success: true,
                    message: isCurrent ? "Current session revoked" : "Session revoked",
                };
            } catch (e) {
                return handleServiceError(e, set);
            }
        },
        {
            params: t.Object({ id: t.String() }),
        }
    );

