import { db } from "@/database";
import { integrations } from "@/database/schema";
import { eq } from "drizzle-orm";
import { logger } from "@/logger";
import { webhookProviders } from "@/providers";
import type { IntegrationForDispatch } from "@/providers";

// -------------------------------------------------------------------
// Main service
// -------------------------------------------------------------------

export class IntegrationWebhookService {
    static async createSubscriptions(integrationId: string): Promise<void> {
        const [integration] = await db
            .select()
            .from(integrations)
            .where(eq(integrations.id, integrationId))
            .limit(1);

        if (!integration) return;

        // Reset error state and mark as "syncing" on each attempt
        await db
            .update(integrations)
            .set({ eventsubSyncError: null, eventsubLastSyncAt: new Date() })
            .where(eq(integrations.id, integrationId));

        // Ensure there is an eventsub secret
        let eventsubSecret = integration.eventsubSecret;
        if (!eventsubSecret) {
            eventsubSecret = Array.from(crypto.getRandomValues(new Uint8Array(32)))
                .map((b) => b.toString(16).padStart(2, "0"))
                .join("");
            await db
                .update(integrations)
                .set({ eventsubSecret })
                .where(eq(integrations.id, integrationId));
        }

        const provider = webhookProviders[integration.provider];
        if (!provider || !provider.createSubscriptions) {
            await db
                .update(integrations)
                .set({ eventsubSyncError: "Unsupported provider" })
                .where(eq(integrations.id, integrationId));
            return;
        }

        try {
            const newSubIds = await provider.createSubscriptions({
                id: integration.id,
                providerUserId: integration.providerUserId,
                eventsubSecret,
            });

            if (newSubIds.length > 0) {
                await db
                    .update(integrations)
                    .set({
                        eventsubSubscriptions: newSubIds,
                        eventsubActive: true,
                        eventsubSyncError: null,
                    })
                    .where(eq(integrations.id, integrationId));
            } else {
                await db
                    .update(integrations)
                    .set({
                        eventsubActive: false,
                        eventsubSyncError: "No subscriptions created",
                    })
                    .where(eq(integrations.id, integrationId));
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error({ err: error }, `Failed to sync webhooks for integration ${integrationId}`);
            await db
                .update(integrations)
                .set({ eventsubActive: false, eventsubSyncError: message })
                .where(eq(integrations.id, integrationId));
        }
    }

    /**
     * Synchronizes all inactive integrations concurrently (max 5 at a time).
     */
    static async syncAll(): Promise<void> {
        const inactiveIntegrations = await db
            .select({ id: integrations.id })
            .from(integrations)
            .where(eq(integrations.eventsubActive, false));

        const CONCURRENCY = 5;
        for (let i = 0; i < inactiveIntegrations.length; i += CONCURRENCY) {
            const batch = inactiveIntegrations.slice(i, i + CONCURRENCY);
            await Promise.allSettled(batch.map((item) => this.createSubscriptions(item.id)));
        }
    }

    static async deleteSubscriptions(integration: IntegrationForDispatch): Promise<void> {
        const provider = webhookProviders[integration.provider];
        if (!provider || !provider.deleteSubscriptions) return;

        if (integration.eventsubSubscriptions && integration.eventsubSubscriptions.length > 0) {
            await provider.deleteSubscriptions(integration);
        }
    }
}
