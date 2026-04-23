import { env } from "@/lib/env";
import { logger } from "@/logger";
import { BadGatewayError } from "@/lib/errors";
import { getAccessToken } from "@/services/token-manager.service";
import type { IntegrationProvider, IntegrationForCreate, IntegrationForDelete, NormalizedChannelReward, OAuthTokenResponse, OAuthUserInfo, IOAuthProvider, IWebhookProvider, IRewardProvider } from "../types";

const MOCK = env.TWITCH_USE_LOCAL_MOCK === true;
export const TWITCH_API_BASE = MOCK ? "http://localhost:8080" : "https://api.twitch.tv/helix";
const TWITCH_AUTH_URL = `https://id.twitch.tv/oauth2/authorize`;
const TWITCH_TOKEN_URL = `https://id.twitch.tv/oauth2/token`;

export class TwitchProvider implements IntegrationProvider, IOAuthProvider, IWebhookProvider, IRewardProvider {
    public readonly name = "twitch" as const;

    private readonly config = {
        clientId: env.TWITCH_CLIENT_ID!,
        clientSecret: env.TWITCH_CLIENT_SECRET!,
        redirectUri: env.TWITCH_REDIRECT_URI!,
        loginScopes: ["user:read:email"],
        connectScopes: [
            "user:read:email",
            "channel:read:redemptions",
            "channel:manage:redemptions",
            "channel:read:subscriptions",
            "moderator:read:followers",
            "bits:read",
            "channel:read:hype_train",
            "channel:read:polls",
            "channel:manage:polls",
            "channel:read:predictions",
            "channel:manage:predictions",
            "channel:read:charity",
            "moderator:read:vips",
            "chat:read",
            "chat:edit",
            "channel:moderate"
        ],
    };

    // ─── Auth ─────────────────────────────────────────────────────────────────

    getAuthUrl(state: string, type: "login" | "connect"): string {
        const scopes = type === "login" ? this.config.loginScopes : this.config.connectScopes;
        const params = new URLSearchParams({
            client_id: this.config.clientId,
            redirect_uri: this.config.redirectUri,
            response_type: "code",
            scope: scopes.join(" "),
            state,
        });
        return `${TWITCH_AUTH_URL}?${params.toString()}`;
    }

    async exchangeCode(code: string): Promise<OAuthTokenResponse> {
        const res = await fetch(TWITCH_TOKEN_URL, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                grant_type: "authorization_code",
                code,
                redirect_uri: this.config.redirectUri,
                client_id: this.config.clientId,
                client_secret: this.config.clientSecret,
            }),
        });

        if (!res.ok) {
            const body = await res.text();
            throw new BadGatewayError(`Twitch token exchange failed: ${body}`);
        }

        return res.json() as Promise<OAuthTokenResponse>;
    }

    async refresh(refreshToken: string): Promise<OAuthTokenResponse> {
        const res = await fetch(TWITCH_TOKEN_URL, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                grant_type: "refresh_token",
                refresh_token: refreshToken,
                client_id: this.config.clientId,
                client_secret: this.config.clientSecret,
            }),
        });

        if (!res.ok) {
            const body = await res.text();
            throw new BadGatewayError(`Twitch token refresh failed: ${body}`);
        }

        return res.json() as Promise<OAuthTokenResponse>;
    }

    async fetchUser(accessToken: string): Promise<OAuthUserInfo> {
        const res = await fetch(`${TWITCH_API_BASE}/users`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Client-Id": this.config.clientId,
            },
        });

        if (!res.ok) {
            const body = await res.text();
            throw new BadGatewayError(`Failed to fetch Twitch user: ${body}`);
        }

        const data = await res.json() as {
            data: Array<{
                id: string;
                login: string;
                profile_image_url: string;
            }>;
        };
        const user = data.data[0];
        if (!user) throw new BadGatewayError("User not found on Twitch");
        return {
            providerUserId: user.id,
            providerUsername: user.login,
            providerAvatarUrl: user.profile_image_url,
        };
    }

    getCacheTtlSeconds(): number {
        return 5 * 60;
    }

    // ─── Webhooks ─────────────────────────────────────────────────────────────

    async createSubscriptions(integration: IntegrationForCreate): Promise<string[]> {
        const accessToken = await getAccessToken(integration.id);
        const subIds: string[] = [];

        const clientId = env.TWITCH_CLIENT_ID;
        if (!clientId) {
            logger.error("Missing TWITCH_CLIENT_ID for webhook creation");
            return [];
        }

        const callbackUrl = `${env.INGEST_URL}/webhook/twitch`;

        if (env.NODE_ENV === "development") {
            console.log(`[DEVELOPMENT] Creating Twitch webhooks with ingest URL: ${env.INGEST_URL}`);
            console.log(`[DEVELOPMENT] Callback URL: ${callbackUrl}`);
        }

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
            const response = await fetch(`${TWITCH_API_BASE}/eventsub/subscriptions`, {
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
                        secret: env.TWITCH_EVENTSUB_SECRET || integration.eventsubSecret,
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
                await fetch(`${TWITCH_API_BASE}/eventsub/subscriptions?id=${subId}`, {
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

    // ─── Rewards ──────────────────────────────────────────────────────────────

    async fetchRewards(integrationId: string, userId: string): Promise<NormalizedChannelReward[]> {
        const accessToken = await getAccessToken(integrationId);

        const clientId = env.TWITCH_CLIENT_ID;
        if (!clientId) {
            throw new Error("Missing TWITCH_CLIENT_ID");
        }

        const res = await fetch(`${TWITCH_API_BASE}/channel_points/custom_rewards?broadcaster_id=${userId}`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Client-Id": clientId,
            },
        });

        if (!res.ok) {
            const body = await res.text();
            logger.error(`[TwitchRewards] Failed to fetch channel rewards: ${res.status} - ${body}`);
            throw new BadGatewayError(`Failed to fetch Twitch channel rewards: ${body}`);
        }

        const data = await res.json() as {
            data: Array<{
                id: string;
                title: string;
                cost: number;
                background_color: string;
                image: { url_1x: string; url_2x: string; url_4x: string } | null;
                default_image: { url_1x: string; url_2x: string; url_4x: string };
            }>;
        };

        return (data.data || []).map((reward) => ({
            id: reward.id,
            title: reward.title,
            cost: reward.cost,
            color: reward.background_color,
            icon: reward.image?.url_1x || reward.default_image?.url_1x || null,
        }));
    }
}
