import Elysia from "elysia";
import { eq, and, isNull } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/jwt";
import { db } from "@/database";
import { sessions, users } from "@/database/schema";

/**
 * Injects `ctx.user` and `ctx.session` from the Bearer token.
 * Use `.use(authMiddleware)` then access `{ user, session }` in your handler.
 */
export const authMiddleware = new Elysia({ name: "auth-middleware" }).derive(
    { as: "scoped" },
    async ({ headers, set }) => {
        const authHeader = headers["authorization"];
        if (!authHeader?.startsWith("Bearer ")) {
            set.status = 401;
            return { error: "Missing or invalid Authorization header" };
        }

        const token = authHeader.slice(7);

        let payload;
        try {
            payload = await verifyAccessToken(token);
        } catch (e: any) {
            set.status = 401;
            return { error: "Invalid or expired access token" };
        }

        // Verify session is still active
        const [session] = await db
            .select()
            .from(sessions)
            .where(
                and(
                    eq(sessions.id, payload.sessionId),
                    isNull(sessions.revokedAt)
                )
            )
            .limit(1);

        if (!session || session.expiresAt < new Date()) {
            set.status = 401;
            return { error: "Session expired or revoked" };
        }

        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, payload.sub))
            .limit(1);

        if (!user) {
            set.status = 401;
            return { error: "User not found" };
        }

        return { user, session };
    }
);

/**
 * Requires email to be verified. Use after authMiddleware.
 */
export const requireVerified = new Elysia({ name: "require-verified" })
    .use(authMiddleware)
    .derive({ as: "scoped" }, ({ user, set }) => {
        if (!user) {
            set.status = 401;
            return { error: "Unauthorized" };
        }
        
        if (!user.emailVerified) {
            set.status = 403;
            return { error: "Email not verified" };
        }
        return {};
    });
