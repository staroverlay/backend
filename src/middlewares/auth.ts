import Elysia from "elysia";
import { eq, and, isNull } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/jwt";
import { db } from "@/database";
import { sessions, users, profiles } from "@/database/schema";

/**
 * Injects `ctx.user` and `ctx.session` from the Bearer token.
 */
export const authMiddleware = (app: Elysia) =>
    app
        .derive({ as: "scoped" }, async ({ headers }) => {
            const authHeader = headers["authorization"];
            if (!authHeader) {
                return {
                    user: null,
                    session: null,
                    authError: "Authorization header missing",
                };
            }
            if (!authHeader.startsWith("Bearer ")) {
                return {
                    user: null,
                    session: null,
                    authError: "Invalid Authorization header format",
                };
            }

            const token = authHeader.slice(7);

            let payload;
            try {
                payload = await verifyAccessToken(token);
            } catch (e: any) {
                return {
                    user: null,
                    session: null,
                    authError: "Invalid or expired access token",
                };
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
                return {
                    user: null,
                    session: null,
                    authError: "Session expired or revoked",
                };
            }

            const [user] = await db
                .select()
                .from(users)
                .where(eq(users.id, payload.sub))
                .limit(1);

            if (!user) {
                return {
                    user: null,
                    session: null,
                    authError: "User not found",
                };
            }

            const [profile] = await db
                .select()
                .from(profiles)
                .where(eq(profiles.userId, user.id))
                .limit(1);

            if (!profile) {
                return {
                    user: null,
                    session: null,
                    authError: "Profile not configured",
                };
            }

            return {
                user: { ...user, profile },
                session,
                authError: null,
            };
        })
        .onBeforeHandle({ as: "scoped" }, ({ user, authError, set, path }) => {
            if (authError || !user) {
                set.status = 401;
                return { error: authError || "Unauthorized" };
            }
        });

/**
 * Requires email to be verified. Use after authMiddleware.
 */
export const requireVerified = (app: Elysia) =>
    app.use(authMiddleware).onBeforeHandle({ as: "scoped" }, ({ user, set }) => {
        if (user && !user.emailVerified) {
            set.status = 403;
            return { error: "Email not verified" };
        }
    });


