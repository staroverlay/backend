import { eq, and, isNull } from "drizzle-orm";
import { createHash } from "crypto";
import { SignJWT, jwtVerify } from "jose";

import { env } from "./env";
import { redis, redisKeys } from "@/database/redis";
import { db } from "@/database";
import { sessions } from "@/database/schema";

export interface AccessPayload {
    sub: string;      // userId
    sessionId: string;
    type: "access";
}

export interface RefreshPayload {
    sub: string;
    sessionId: string;
    type: "refresh";
}

export interface TokenPair {
    accessToken: string;
    refreshToken: string;
    accessExpiresAt: Date;
    refreshExpiresAt: Date;
}

const ACCESS_SECRET = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
const REFRESH_SECRET = new TextEncoder().encode(env.JWT_REFRESH_SECRET);

export function hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
}

export async function signAccessToken(payload: Omit<AccessPayload, "type">): Promise<string> {
    return new SignJWT({ ...payload, type: "access" })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(`${env.JWT_ACCESS_EXPIRES_MIN}m`)
        .sign(ACCESS_SECRET);
}

export async function signRefreshToken(payload: Omit<RefreshPayload, "type">): Promise<string> {
    return new SignJWT({ ...payload, type: "refresh" })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(`${env.JWT_REFRESH_EXPIRES_DAYS}d`)
        .sign(REFRESH_SECRET);
}

export async function verifyAccessToken(token: string): Promise<AccessPayload> {
    try {
        const { payload } = await jwtVerify(token, ACCESS_SECRET);
        
        if (payload.type !== "access") {
            throw new Error("Invalid token type");
        }

        return payload as unknown as AccessPayload;
    } catch (error) {
        if (error instanceof Error) throw error;
        throw new Error("Invalid token");
    }
}

export async function verifyRefreshToken(token: string): Promise<RefreshPayload> {
    try {
        const { payload } = await jwtVerify(token, REFRESH_SECRET);
        
        if (payload.type !== "refresh") {
            throw new Error("Invalid token type");
        }

        return payload as unknown as RefreshPayload;
    } catch (error) {
        if (error instanceof Error) throw error;
        throw new Error("Invalid token");
    }
}


/**
 * Rotate a refresh token. Implements grace period:
 * - If the old token is in the grace window, returns the already-rotated pair.
 * - Otherwise, generates a new pair, revokes the old session, creates a new one, 
 *   and stores the grace period entry in Redis.
 */
export async function rotateRefreshToken(
    oldRefreshToken: string,
    meta: { ipAddress?: string; userAgent?: string }
): Promise<TokenPair & { sessionId: string }> {
    // 1. Verify the old token is structurally valid
    const payload = await verifyRefreshToken(oldRefreshToken);
    const oldHash = hashToken(oldRefreshToken);
    const graceKey = redisKeys.refreshGrace(oldHash);

    // 2. Check grace period (debounce window)
    const cached = await redis.get(graceKey);
    if (cached) {
        const grace = JSON.parse(cached) as {
            accessToken: string;
            refreshToken: string;
            accessExpiresAt: string;
            refreshExpiresAt: string;
            sessionId: string;
        };
        return {
            accessToken: grace.accessToken,
            refreshToken: grace.refreshToken,
            accessExpiresAt: new Date(grace.accessExpiresAt),
            refreshExpiresAt: new Date(grace.refreshExpiresAt),
            sessionId: grace.sessionId,
        };
    }

    // 3. Verify session exists and is valid in DB
    const [session] = await db
        .select()
        .from(sessions)
        .where(
            and(
                eq(sessions.refreshTokenHash, oldHash),
                isNull(sessions.revokedAt)
            )
        )
        .limit(1);

    if (!session) throw new Error("Session not found or revoked");
    if (session.expiresAt < new Date()) throw new Error("Session expired");

    // 4. Generate new token pair
    const accessExpiresAt = new Date(Date.now() + env.JWT_ACCESS_EXPIRES_MIN * 60 * 1000);
    const refreshExpiresAt = new Date(Date.now() + env.JWT_REFRESH_EXPIRES_DAYS * 86400 * 1000);

    const newRefreshToken = await signRefreshToken({ sub: payload.sub, sessionId: session.id });
    const newAccessToken = await signAccessToken({ sub: payload.sub, sessionId: session.id });
    const newHash = hashToken(newRefreshToken);

    // 5. Update session with new hash
    await db
        .update(sessions)
        .set({
            refreshTokenHash: newHash,
            ipAddress: meta.ipAddress ?? session.ipAddress,
            userAgent: meta.userAgent ?? session.userAgent,
            expiresAt: refreshExpiresAt,
            updatedAt: new Date(),
        })
        .where(eq(sessions.id, session.id));

    // 6. Store grace period in Redis
    const graceTTLSeconds = env.JWT_REFRESH_GRACE_MINUTES * 60;
    await redis.setex(
        graceKey,
        graceTTLSeconds,
        JSON.stringify({
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
            accessExpiresAt: accessExpiresAt.toISOString(),
            refreshExpiresAt: refreshExpiresAt.toISOString(),
            sessionId: session.id,
        })
    );

    return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        accessExpiresAt,
        refreshExpiresAt,
        sessionId: session.id,
    };
}