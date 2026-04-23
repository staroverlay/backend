import { db } from "@/database";
import { integrations } from "@/database/schema";
import { env } from "@/lib/env";
import { eq } from "drizzle-orm";
import { logger } from "@/logger";
import { getAccessToken } from "./token-manager.service";

// -------------------------------------------------------------------
// Typed interfaces used across this service
// -------------------------------------------------------------------

interface IntegrationForCreate {
    id: string;
    providerUserId: string;
    eventsubSecret: string;
}

interface IntegrationForDelete {
    id: string;
    eventsubSubscriptions: string[];
}

interface IntegrationForDispatch {
    id: string;
    provider: string;
    eventsubSubscriptions: string[];
}

// -------------------------------------------------------------------
// Provider interface
// -------------------------------------------------------------------

export interface WebhookProvider {
    createSubscriptions(integration: IntegrationForCreate): Promise<string[]>;
    deleteSubscriptions(integration: IntegrationForDelete): Promise<void>;
}

// -------------------------------------------------------------------
// Twitch implementation
// -------------------------------------------------------------------

export class TwitchWebhookProvider implements WebhookProvider {
    async createSubscriptions(integration: IntegrationForCreate): Promise<string[]> {
        const accessToken = await getAccessToken(integration.id);
        const subIds: string[] = [];

        const clientId = env.TWITCH_CLIENT_ID;
        if (!clientId) {
            logger.error("Missing TWITCH_CLIENT_ID for webhook creation");
            return [];
        }

        const callbackUrl = `${env.INGEST_URL}/webhook/twitch/${integration.id}`;

        const subscriptions = [
            {
                type: "channel.follow",
                version: "2",
                condition: {
                    broadcaster_user_id: integration.providerUserId,
                    moderator_user_id: integration.providerUserId,
                },
            },
            {
                type: "stream.online",
                version: "1",
                condition: { broadcaster_user_id: integration.providerUserId },
            },
            {
                type: "channel.subscribe",
                version: "1",
                condition: { broadcaster_user_id: integration.providerUserId },
            },
        ];

        for (const sub of subscriptions) {
            const response = await fetch("https://api.twitch.tv/helix/eventsub/subscriptions", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Client-Id": clientId,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    type: sub.type,
                    version: sub.version,
                    condition: sub.condition,
                    transport: {
                        method: "webhook",
                        callback: callbackUrl,
                        secret: integration.eventsubSecret,
                    },
                }),
            });

            const data = (await response.json()) as { data?: Array<{ id: string }>; message?: string };

            if (!response.ok) {
                const message = data.message || `HTTP ${response.status}`;
                logger.error(`TWITCH ERROR: Failed to create ${sub.type} subscription: ${message}`);
                throw new Error(`Twitch API Error: ${message}`);
            }

            if (data.data && data.data.length > 0 && data.data[0]) {
                subIds.push(data.data[0].id);
            }
        }

        return subIds;
    }

    async deleteSubscriptions(integration: IntegrationForDelete): Promise<void> {
        let accessToken: string;
        try {
            accessToken = await getAccessToken(integration.id);
        } catch (e) {
            logger.error({ err: e }, `Failed to get access token for integration ${integration.id} during delete`);
            return;
        }

        const clientId = env.TWITCH_CLIENT_ID;
        if (!clientId) return;

        for (const subId of integration.eventsubSubscriptions) {
            try {
                await fetch(`https://api.twitch.tv/helix/eventsub/subscriptions?id=${subId}`, {
                    method: "DELETE",
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        "Client-Id": clientId,
                    },
                });
            } catch (error) {
                logger.error({ err: error }, `Error deleting subscription ${subId}`);
            }
        }
    }
}

// -------------------------------------------------------------------
// Main service
// -------------------------------------------------------------------

export class IntegrationWebhookService {
    private static providers: Record<string, WebhookProvider> = {
        twitch: new TwitchWebhookProvider(),
    };

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

        const provider = this.providers[integration.provider];
        if (!provider) {
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
        const provider = this.providers[integration.provider];
        if (!provider) return;

        if (integration.eventsubSubscriptions && integration.eventsubSubscriptions.length > 0) {
            await provider.deleteSubscriptions(integration);
        }
    }
}
