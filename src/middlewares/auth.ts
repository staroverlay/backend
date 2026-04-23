import Elysia from "elysia";
import { eq, and, isNull } from "drizzle-orm";

import { verifyAccessToken } from "@/lib/jwt";
import { db } from "@/database";
import { sessions, users, profiles } from "@/database/schema";

/**
 * Injects `ctx.user` and `ctx.session` from the Bearer token.
 * FIXED P-02: Optimized to use a single SQL join query instead of 3 sequential ones.
 */
export const authMiddleware = (app: Elysia) =>
    app
        .derive({ as: "scoped" }, async ({ headers }) => {
            const authHeader = headers["authorization"];
            if (!authHeader || !authHeader.startsWith("Bearer ")) {
                return {
                    user: null,
                    session: null,
                    authError: authHeader ? "Invalid Authorization header format" : "Authorization header missing",
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

            // FIXED P-02: Single query with JOINs for session, user, and profile
            const rows = await db
                .select({
                    session: sessions,
                    user: users,
                    profile: profiles,
                })
                .from(sessions)
                .innerJoin(users, eq(sessions.userId, users.id))
                .innerJoin(profiles, eq(users.id, profiles.userId))
                .where(
                    and(
                        eq(sessions.id, payload.sessionId),
                        eq(users.id, payload.sub),
                        isNull(sessions.revokedAt)
                    )
                )
                .limit(1);

            const row = rows[0];

            if (!row || row.session.expiresAt < new Date()) {
                return {
                    user: null,
                    session: null,
                    authError: !row ? "Session expired or revoked" : "Session expired",
                };
            }

            return {
                user: { ...row.user, profile: row.profile },
                session: row.session,
                authError: null,
            };
        })
        .onBeforeHandle({ as: "scoped" }, ({ user, authError, set }) => {
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
