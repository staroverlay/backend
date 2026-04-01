import Elysia, { t } from "elysia";

import {
    registerUser,
    loginWithEmail,
    verifyEmail,
    resendVerification,
    changePassword,
    revokeSession,
    revokeAllSessions,
} from "@/services/auth.service";
import { rotateRefreshToken } from "@/lib/jwt";
import { authMiddleware } from "@/middlewares/auth";
import { getClientMeta, handleServiceError } from "@/lib/request-helpers";
import { rateLimit } from "@/middlewares/rate-limit";

export const authRoutes = new Elysia({ prefix: "/auth" })
    // Register
    .post(
        "/register",
        async ({ body, set }) => {
            try {
                const { userId } = await registerUser(body.email, body.password);
                return { success: true, userId, message: "Verification email sent" };
            } catch (e) {
                return handleServiceError(e, set);
            }
        },
        {
            beforeHandle: [rateLimit({ limit: 5, duration: 60 })],
            body: t.Object({
                email: t.String({ format: "email" }),
                password: t.String({
                    minLength: 8,
                    pattern: "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).{8,}$"
                }),
            }),
        }
    )

    // Verify Email
    .post(
        "/verify-email",
        async ({ body, set }) => {
            try {
                await verifyEmail(body.email, body.code);
                return { success: true, message: "Email verified" };
            } catch (e) {
                return handleServiceError(e, set);
            }
        },
        {
            body: t.Object({
                email: t.String({ format: "email" }),
                code: t.String({ minLength: 6, maxLength: 6 }),
            }),
        }
    )



    // Login
    .post(
        "/login",
        async ({ body, request, set }) => {
            try {
                const tokens = await loginWithEmail(body.email, body.password, getClientMeta(request));
                return { success: true, ...tokens };
            } catch (e) {
                return handleServiceError(e, set);
            }
        },
        {
            beforeHandle: [rateLimit({ limit: 10, duration: 60 })],
            body: t.Object({
                email: t.String({ format: "email" }),
                password: t.String(),
            }),
        }
    )

    // Refresh Token
    .post(
        "/refresh",
        async ({ body, request, set }) => {
            try {
                const result = await rotateRefreshToken(body.refreshToken, getClientMeta(request));
                return { success: true, ...result };
            } catch (e) {
                set.status = 401;
                return { error: "Invalid or expired refresh token" };
            }
        },
        {
            beforeHandle: [rateLimit({ limit: 10, duration: 60 })],
            body: t.Object({
                refreshToken: t.String(),
            }),
        }
    )

    // Logout (current session)
    .use(authMiddleware)

    // Resend Verification (moved here to need auth)
    .post("/resend-verification", async ({ user, set }) => {
        try {
            await resendVerification(user!.id);
            return { success: true, message: "Verification email resent" };
        } catch (e) {
            return handleServiceError(e, set);
        }
    }, {
        beforeHandle: [rateLimit({ limit: 5, duration: 60 })]
    })

    .post("/logout", async ({ session, set }) => {
        try {
            await revokeSession(session!.id);
            return { success: true, message: "Logged out" };
        } catch (e) {
            return handleServiceError(e, set);
        }
    })

    // Logout all sessions
    .post("/logout-all", async ({ user, set }) => {
        try {
            await revokeAllSessions(user!.id);
            return { success: true, message: "All sessions revoked" };
        } catch (e) {
            return handleServiceError(e, set);
        }
    })

    // Change Password
    .post(
        "/change-password",
        async ({ user, body, set }) => {
            try {
                await changePassword(user!.id, body.oldPassword, body.newPassword);
                return { success: true, message: "Password changed. All sessions revoked." };
            } catch (e) {
                return handleServiceError(e, set);
            }
        },
        {
            body: t.Object({
                oldPassword: t.String(),
                newPassword: t.String({
                    minLength: 8,
                    pattern: "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).{8,}$"
                }),
            }),
        }
    )


    // Me
    .get("/me", ({ user }) => ({
        id: user!.id,
        email: user!.email,
        emailVerified: user!.emailVerified,
        createdAt: user!.createdAt,
    }));
