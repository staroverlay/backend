import { eq, and, isNull } from "drizzle-orm";
import argon2 from "argon2";

import { hashToken, signAccessToken, signRefreshToken } from "@/lib/jwt";
import { sendVerificationEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { db } from "@/database";
import { profiles, sessions, users } from "@/database/schema";
import {
    BadRequestError,
    ConflictError,
    ForbiddenError,
    InternalServerError,
    NotFoundError,
    UnauthorizedError
} from "@/lib/errors";
import { redis, redisKeys } from "@/database/redis";

// Helpers

function generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function verificationExpiry(): Date {
    return new Date(Date.now() + 60 * 60 * 1000); // 1 hour
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
        throw new ConflictError("Email already registered");
    }

    // Beta Whitelist Check
    if (env.FEATURE_EMAIL_WHITELIST) {
        const whitelistKey = redisKeys.whitelist(email);
        const whitelisted = await redis.get(whitelistKey);

        if (!whitelisted) {
            throw new ForbiddenError("Your email is not on the beta whitelist. Please request access.");
        }

        // Consume whitelist (delete it)
        await redis.del(whitelistKey);
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

    if (!user) throw new InternalServerError("Failed to create user");

    await sendVerificationEmail(email, verificationCode);

    return { userId: user.id };
}

// Verify Email

export async function verifyEmail(email: string, code: string): Promise<void> {
    const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email.toLowerCase()))
        .limit(1);

    if (!user) throw new NotFoundError("User not found");
    if (user.emailVerified) throw new BadRequestError("Email already verified");

    const isDevBypass = env.NODE_ENV === "development" && code === "000000";
    const isValid = user.emailVerificationCode === code;
    const isExpired = !user.emailVerificationExpiry || user.emailVerificationExpiry < new Date();

    if (!isDevBypass && (!isValid || isExpired)) {
        throw new BadRequestError("Invalid or expired verification code");
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

    // Create profile automatically when email is verified for the first time
    await db
        .insert(profiles)
        .values({
            userId: user.id,
            displayName: user.email.split("@")[0] || "User",
        })
        .onConflictDoNothing({ target: profiles.userId });
}

export async function resendVerification(email: string): Promise<void> {
    const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email.toLowerCase()))
        .limit(1);

    if (!user) throw new NotFoundError("User not found");
    if (user.emailVerified) throw new BadRequestError("Email already verified");

    // 1-minute cooldown check
    // if emailVerificationExpiry exists and it was created less than 1 min ago.
    // Expires is now + 15m. If its more than 14m in the future, it was sent less than 1m ago.
    const now = Date.now();
    const expiry = user.emailVerificationExpiry?.getTime() ?? 0;
    const cooldownMs = 60 * 1000;
    const timeSinceLastSent = (15 * 60 * 1000) - (expiry - now); // rough estimate

    if (expiry > now && (expiry - now) > (14 * 60 * 1000)) {
        throw new BadRequestError("Please wait 60 seconds before requesting another email");
    }

    const code = generateVerificationCode();
    await db
        .update(users)
        .set({
            emailVerificationCode: code,
            emailVerificationExpiry: verificationExpiry(),
            updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));

    await sendVerificationEmail(user.email, code);
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
        throw new UnauthorizedError("Invalid credentials");
    }

    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) throw new UnauthorizedError("Invalid credentials");

    if (!user.emailVerified) {
        throw new ForbiddenError("EMAIL_NOT_VERIFIED");
    }

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

    const sessionId = crypto.randomUUID();

    const [accessToken, refreshToken] = await Promise.all([
        signAccessToken({ sub: userId, sessionId }),
        signRefreshToken({ sub: userId, sessionId }),
    ]);

    const refreshHash = hashToken(refreshToken);

    const [session] = await db
        .insert(sessions)
        .values({
            id: sessionId,
            userId,
            refreshTokenHash: refreshHash,
            loginMethod,
            ipAddress: meta.ipAddress,
            userAgent: meta.userAgent,
            expiresAt: refreshExpiresAt,
        })
        .returning({ id: sessions.id });

    if (!session) throw new InternalServerError("Failed to create session");

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
        throw new BadRequestError("User has no password set");
    }

    const valid = await argon2.verify(user.passwordHash, oldPassword);
    if (!valid) throw new UnauthorizedError("Old password is incorrect");

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