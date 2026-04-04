import { eq, and, gt, or, isNull } from "drizzle-orm";
import { db } from "@/database";
import { subscriptions } from "@/database/schema";
import { TIERS, DEFAULT_PLAN_ID, getPlanById, type Plan } from "@/constants/tiers";

export interface UserSubscription {
    id: string;
    userId: string;
    planId: string;
    expiresAt: Date | null;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Get the current active subscription for a user.
 * Returns null if no active subscription exists.
 */
export async function getCurrentSubscription(userId: string): Promise<UserSubscription | null> {
    const now = new Date();

    // Find an active subscription that hasn't expired.
    // If expiresAt is null, it's considered non-expiring.
    const [subscription] = await db
        .select()
        .from(subscriptions)
        .where(
            and(
                eq(subscriptions.userId, userId),
                eq(subscriptions.active, true),
                or(
                    isNull(subscriptions.expiresAt),
                    gt(subscriptions.expiresAt, now)
                )
            )
        )
        .limit(1);

    if (!subscription) {
        return null;
    }

    return {
        id: subscription.id,
        userId: subscription.userId,
        planId: subscription.planId,
        expiresAt: subscription.expiresAt,
        active: subscription.active,
        createdAt: subscription.createdAt,
        updatedAt: subscription.updatedAt,
    };
}

/**
 * Get the plan object for a user based on their current active subscription.
 * Defaults to the "free" plan if no active subscription exists.
 */
export async function getUserPlan(userId: string): Promise<Plan> {
    const sub = await getCurrentSubscription(userId);
    const planId = sub?.planId || DEFAULT_PLAN_ID;
    return getPlanById(planId);
}

/**
 * Returns all available plans/tiers.
 */
export function getAllPlans(): Plan[] {
    return TIERS;
}
