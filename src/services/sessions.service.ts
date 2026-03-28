import { eq, and, isNull, desc } from "drizzle-orm";

import { db } from "@/database";
import { sessions } from "@/database/schema";

export interface SessionSafe {
    id: string;
    ipAddress: string | null;
    userAgent: string | null;
    loginMethod: string;
    expiresAt: Date;
    createdAt: Date;
    current?: boolean;
}

export async function listActiveSessions(userId: string, currentSessionId: string): Promise<SessionSafe[]> {
    const list = await db
        .select({
            id: sessions.id,
            ipAddress: sessions.ipAddress,
            userAgent: sessions.userAgent,
            loginMethod: sessions.loginMethod,
            expiresAt: sessions.expiresAt,
            createdAt: sessions.createdAt,
        })
        .from(sessions)
        .where(
            and(
                eq(sessions.userId, userId),
                isNull(sessions.revokedAt)
            )
        )
        .orderBy(desc(sessions.createdAt));

    return list.map((s) => ({
        ...s,
        current: s.id === currentSessionId,
    }));
}

export async function revokeSession(userId: string, sessionId: string): Promise<boolean> {
    const [target] = await db
        .select({ id: sessions.id, userId: sessions.userId })
        .from(sessions)
        .where(
            and(
                eq(sessions.id, sessionId),
                isNull(sessions.revokedAt)
            )
        )
        .limit(1);

    if (!target) {
        throw Object.assign(new Error("Session not found"), { status: 404 });
    }

    if (target.userId !== userId) {
        throw Object.assign(new Error("Forbidden"), { status: 403 });
    }

    await db
        .update(sessions)
        .set({ revokedAt: new Date() })
        .where(eq(sessions.id, sessionId));

    return target.id === sessionId;
}
