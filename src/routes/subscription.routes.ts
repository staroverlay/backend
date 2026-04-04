import Elysia from "elysia";
import { requireVerified } from "@/middlewares/auth";
import { getCurrentSubscription, getAllPlans } from "@/services/subscription.service";
import { handleServiceError } from "@/lib/request-helpers";

export const subscriptionRoutes = new Elysia({ prefix: "/subscription" })
    /**
     * Get all available subscription plans/tiers and their limits.
     */
    .get("/plans", () => {
        return getAllPlans();
    })

    /**
     * Authenticated routes
     */
    .use(requireVerified)

    /**
     * Get the active subscription for the currently logged in user.
     * Returns null if no active subscription exists.
     */
    .get("/current", async ({ user, set }) => {
        try {
            const sub = await getCurrentSubscription(user!.id);
            return sub;
        } catch (e) {
            return handleServiceError(e, set);
        }
    });
