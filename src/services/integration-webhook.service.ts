import { db } from "@/database";
import { integrations } from "@/database/schema";
import { env } from "@/lib/env";
import { eq } from "drizzle-orm";
import { getAccessToken } from "./token-manager.service";

export interface WebhookProvider {
    createSubscriptions(integration: any): Promise<string[]>;
    deleteSubscriptions(integration: any): Promise<void>;
}

export class TwitchWebhookProvider implements WebhookProvider {
    async createSubscriptions(integration: { id: string; providerUserId: string; eventsubSecret: string }): Promise<string[]> {
        const accessToken = await getAccessToken(integration.id);
        const subIds: string[] = [];

        const clientId = env.TWITCH_CLIENT_ID;
        if (!clientId) {
            console.error("Missing TWITCH_CLIENT_ID for webhook creation");
            return [];
        }

        const callbackUrl = `${env.INGEST_URL}/webhook/twitch/${integration.id}`;

        const subscriptions = [
            { type: "channel.follow", version: "2", condition: { broadcaster_user_id: integration.providerUserId, moderator_user_id: integration.providerUserId } },
            { type: "stream.online", version: "1", condition: { broadcaster_user_id: integration.providerUserId } },
            { type: "channel.subscribe", version: "1", condition: { broadcaster_user_id: integration.providerUserId } }
        ];

        for (const sub of subscriptions) {
            try {
                const response = await fetch("https://api.twitch.tv/helix/eventsub/subscriptions", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${accessToken}`,
                        "Client-Id": clientId,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        type: sub.type,
                        version: sub.version,
                        condition: sub.condition,
                        transport: {
                            method: "webhook",
                            callback: callbackUrl,
                            secret: integration.eventsubSecret
                        }
                    })
                });

                const data = await response.json() as any;

                if (!response.ok) {
                    const message = data.message || `HTTP ${response.status}`;
                    console.error(`TWITCH ERROR: Failed to create ${sub.type} subscription: ${message}`);
                    throw new Error(`Twitch API Error: ${message}`);
                }

                if (data.data && data.data.length > 0 && data.data[0]) {
                    subIds.push(data.data[0].id);
                }
            } catch (error: any) {
                console.error(`Error creating ${sub.type} subscription:`, error);
                throw error; // Bubble up for the service to catch and store in DB
            }
        }

        return subIds;
    }

    async deleteSubscriptions(integration: { id: string; eventsubSubscriptions: string[] }): Promise<void> {
        try {
            const accessToken = await getAccessToken(integration.id);
            const clientId = env.TWITCH_CLIENT_ID;
            if (!clientId) return;

            for (const subId of integration.eventsubSubscriptions) {
                try {
                    await fetch(`https://api.twitch.tv/helix/eventsub/subscriptions?id=${subId}`, {
                        method: "DELETE",
                        headers: {
                            "Authorization": `Bearer ${accessToken}`,
                            "Client-Id": clientId,
                        }
                    });
                } catch (error) {
                    console.error(`Error deleting subscription ${subId}:`, error);
                }
            }
        } catch (e) {
            console.error("Error fetching access token or deleting subs", e);
        }
    }
}

export class IntegrationWebhookService {
    private static providers: Record<string, WebhookProvider> = {
        twitch: new TwitchWebhookProvider()
    };

    static async createSubscriptions(integrationId: string) {
        const [integration] = await db
            .select()
            .from(integrations)
            .where(eq(integrations.id, integrationId))
            .limit(1);

        if (!integration) return;

        // Reset error state on each attempt
        await db.update(integrations).set({
            eventsubSyncError: null,
            eventsubLastSyncAt: new Date()
        }).where(eq(integrations.id, integrationId));

        let eventsubSecret = integration.eventsubSecret;
        if (!eventsubSecret) {
            eventsubSecret = Array.from(crypto.getRandomValues(new Uint8Array(32)))
                .map((b) => b.toString(16).padStart(2, "0"))
                .join("");
            await db.update(integrations).set({ eventsubSecret }).where(eq(integrations.id, integrationId));
        }

        const provider = this.providers[integration.provider];
        if (!provider) {
            await db.update(integrations).set({ eventsubSyncError: "Unsupported provider" }).where(eq(integrations.id, integrationId));
            return;
        }

        try {
            const newSubIds = await provider.createSubscriptions({
                id: integration.id,
                providerUserId: integration.providerUserId,
                eventsubSecret
            });

            if (newSubIds.length > 0) {
                await db
                    .update(integrations)
                    .set({
                        eventsubSubscriptions: newSubIds,
                        eventsubActive: true,
                        eventsubSyncError: null
                    })
                    .where(eq(integrations.id, integrationId));
            } else {
                await db
                    .update(integrations)
                    .set({
                        eventsubActive: false,
                        eventsubSyncError: "No subscriptions created"
                    })
                    .where(eq(integrations.id, integrationId));
            }
        } catch (error: any) {
            console.error(`Failed to sync webhooks for integration ${integrationId}:`, error);
            await db
                .update(integrations)
                .set({
                    eventsubActive: false,
                    eventsubSyncError: error.message || String(error)
                })
                .where(eq(integrations.id, integrationId));
        }
    }

    /**
     * Finds and synchronizes all inactive integrations that should have webhooks.
     */
    static async syncAll() {
        const inactiveIntegrations = await db
            .select({ id: integrations.id })
            .from(integrations)
            .where(eq(integrations.eventsubActive, false));

        for (const i of inactiveIntegrations) {
            // Sequential sync to avoid hitting rate limits too hard
            await this.createSubscriptions(i.id);
        }
    }

    static async deleteSubscriptions(integration: { id: string; provider: string; eventsubSubscriptions: string[] }) {
        const provider = this.providers[integration.provider];
        if (!provider) return;

        if (integration.eventsubSubscriptions && integration.eventsubSubscriptions.length > 0) {
            await provider.deleteSubscriptions(integration);
        }
    }
}
