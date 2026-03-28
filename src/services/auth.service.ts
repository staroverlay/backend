import { eq, and, isNull } from "drizzle-orm";
import argon2 from "argon2";

import { hashToken, signAccessToken, signRefreshToken } from "@/lib/jwt";
import { sendVerificationEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { db } from "@/database";
import { sessions, users } from "@/database/schema";

// Helpers

function generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function verificationExpiry(): Date {
    return new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
}

export async function registerUser(
    email: string,
    password: string
): Promise<{ userId: string }> {
    const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email.toLowerCase()))
        .limit(1);

    if (existing.length > 0) {
        throw Object.assign(new Error("Email already registered"), { status: 409 });
    }

    const passwordHash = await argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
    });

    const verificationCode = generateVerificationCode();

    const [user] = await db
        .insert(users)
        .values({
            email: email.toLowerCase(),
            passwordHash,
            emailVerificationCode: verificationCode,
            emailVerificationExpiry: verificationExpiry(),
        })
        .returning({ id: users.id });

    if (!user) throw new Error("Failed to create user");

    await sendVerificationEmail(email, verificationCode);

    return { userId: user.id };
}

// ... lines 58-163 remained the same ... (skipping for brevity in ReplacementContent)
// Wait, replace_file_content needs the WHOLE block. Let's do it carefully.


// Verify Email

export async function verifyEmail(email: string, code: string): Promise<void> {
    const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email.toLowerCase()))
        .limit(1);

    if (!user) throw Object.assign(new Error("User not found"), { status: 404 });
    if (user.emailVerified) throw Object.assign(new Error("Email already verified"), { status: 400 });

    if (
        user.emailVerificationCode !== code ||
        !user.emailVerificationExpiry ||
        user.emailVerificationExpiry < new Date()
    ) {
        throw Object.assign(new Error("Invalid or expired verification code"), { status: 400 });
    }

    await db
        .update(users)
        .set({
            emailVerified: true,
            emailVerificationCode: null,
            emailVerificationExpiry: null,
            updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));
}

export async function resendVerification(email: string): Promise<void> {
    const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email.toLowerCase()))
        .limit(1);

    if (!user) throw Object.assign(new Error("User not found"), { status: 404 });
    if (user.emailVerified) throw Object.assign(new Error("Email already verified"), { status: 400 });

    const code = generateVerificationCode();
    await db
        .update(users)
        .set({
            emailVerificationCode: code,
            emailVerificationExpiry: verificationExpiry(),
            updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));

    await sendVerificationEmail(email, code);
}

export async function loginWithEmail(
    email: string,
    password: string,
    meta: { ipAddress?: string; userAgent?: string }
): Promise<{
    accessToken: string;
    refreshToken: string;
    accessExpiresAt: Date;
    refreshExpiresAt: Date;
}> {
    const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email.toLowerCase()))
        .limit(1);

    if (!user || !user.passwordHash) {
        throw Object.assign(new Error("Invalid credentials"), { status: 401 });
    }

    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) throw Object.assign(new Error("Invalid credentials"), { status: 401 });

    return createSession(user.id, "email", meta);
}

export async function createSession(
    userId: string,
    loginMethod: "email" | "oauth_twitch" | "oauth_kick" | "oauth_youtube",
    meta: { ipAddress?: string; userAgent?: string }
): Promise<{
    accessToken: string;
    refreshToken: string;
    accessExpiresAt: Date;
    refreshExpiresAt: Date;
}> {
    const refreshExpiresAt = new Date(
        Date.now() + env.JWT_REFRESH_EXPIRES_DAYS * 86400 * 1000
    );

    const [session] = await db
        .insert(sessions)
        .values({
            userId,
            refreshTokenHash: "pending",
            loginMethod,
            ipAddress: meta.ipAddress,
            userAgent: meta.userAgent,
            expiresAt: refreshExpiresAt,
        })
        .returning({ id: sessions.id });

    if (!session) throw new Error("Failed to create session");

    const [accessToken, refreshToken] = await Promise.all([
        signAccessToken({ sub: userId, sessionId: session.id }),
        signRefreshToken({ sub: userId, sessionId: session.id }),
    ]);

    const refreshHash = hashToken(refreshToken);

    await db
        .update(sessions)
        .set({ refreshTokenHash: refreshHash })
        .where(eq(sessions.id, session.id));

    return {
        accessToken,
        refreshToken,
        accessExpiresAt: new Date(Date.now() + env.JWT_ACCESS_EXPIRES_MIN * 60 * 1000),
        refreshExpiresAt,
    };
}

export async function changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string
): Promise<void> {
    const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

    if (!user || !user.passwordHash) {
        throw Object.assign(new Error("User has no password set"), { status: 400 });
    }

    const valid = await argon2.verify(user.passwordHash, oldPassword);
    if (!valid) throw Object.assign(new Error("Old password is incorrect"), { status: 401 });

    const newHash = await argon2.hash(newPassword, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
    });

    await db
        .update(users)
        .set({ passwordHash: newHash, updatedAt: new Date() })
        .where(eq(users.id, userId));

    // Revoke all sessions except the current one would be optional.
    // Here we revoke ALL for security after password change.
    await db
        .update(sessions)
        .set({ revokedAt: new Date() })
        .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
}

export async function revokeSession(sessionId: string): Promise<void> {
    await db
        .update(sessions)
        .set({ revokedAt: new Date() })
        .where(eq(sessions.id, sessionId));
}

export async function revokeAllSessions(userId: string): Promise<void> {
    await db
        .update(sessions)
        .set({ revokedAt: new Date() })
        .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
}