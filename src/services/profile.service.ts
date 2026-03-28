import { eq } from "drizzle-orm";

import { db } from "@/database";
import { profiles } from "@/database/schema";

export interface ProfileData {
    id: string;
    userId: string;
    displayName: string;
    createdAt: Date;
    updatedAt: Date;
}

export async function getProfile(userId: string): Promise<ProfileData> {
    const [profile] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.userId, userId))
        .limit(1);

    if (!profile) {
        throw Object.assign(
            new Error("Profile not configured"),
            { status: 404 }
        );
    }

    return {
        id: profile.id,
        userId: profile.userId,
        displayName: profile.displayName,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
    };
}

export interface UpsertProfileResult {
    created: boolean;
    profile: ProfileData;
}

export async function upsertProfile(
    userId: string,
    displayName: string
): Promise<UpsertProfileResult> {
    const [existing] = await db
        .select({ id: profiles.id })
        .from(profiles)
        .where(eq(profiles.userId, userId))
        .limit(1);

    if (existing) {
        const [updated] = await db
            .update(profiles)
            .set({ displayName, updatedAt: new Date() })
            .where(eq(profiles.id, existing.id))
            .returning();

        return { created: false, profile: updated! };
    } else {
        const [created] = await db
            .insert(profiles)
            .values({ userId, displayName })
            .returning();

        return { created: true, profile: created! };
    }
}

export async function deleteProfile(userId: string): Promise<void> {
    const result = await db
        .delete(profiles)
        .where(eq(profiles.userId, userId))
        .returning({ id: profiles.id });

    if (result.length === 0) {
        throw Object.assign(new Error("Profile not found"), { status: 404 });
    }
}
