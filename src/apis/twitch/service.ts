import { env } from "@/lib/env";
import { logger } from "@/logger";
import { BadGatewayError, InternalServerError } from "@/lib/errors";
import type { IProviderApiService, OAuthTokenResponse, OAuthUserInfo, NormalizedChannelReward } from "../types";

export const TWITCH_EVENTSUB_WS_URL = "wss://eventsub.wss.twitch.tv/ws";
export const TWITCH_API_BASE = "https://api.twitch.tv/helix";
export const TWITCH_AUTH_URL = "https://id.twitch.tv/oauth2/authorize";
export const TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token";

export class TwitchApiService implements IProviderApiService {
    public readonly provider = "twitch";

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

    /**
     * Registers a new EventSub subscription via WebSocket.
     */
    async registerSubscription(opts: {
        accessToken: string;
        clientId: string;
        sessionId: string;
        channelId: string;
        subType: string;
        version: string;
        condition: (channelId: string) => any;
    }): Promise<string | null> {
        const body = {
            type: opts.subType,
            version: opts.version,
            condition: opts.condition(opts.channelId),
            transport: { method: "websocket", session_id: opts.sessionId },
        };

        try {
            const res = await fetch(`${TWITCH_API_BASE}/eventsub/subscriptions`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${opts.accessToken}`,
                    "Client-Id": opts.clientId,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const err = await res.text();
                logger.error(`[TwitchApi] Failed to register "${opts.subType}": ${res.status} - ${err}`);
                return null;
            }

            const json = await res.json() as any;
            return json?.data?.[0]?.id || null;
        } catch (err) {
            logger.error(`[TwitchApi] Network error registering "${opts.subType}": ${err}`);
            return null;
        }
    }

    /**
     * Revokes a single EventSub subscription.
     */
    async revokeSubscription(accessToken: string, clientId: string, subId: string): Promise<boolean> {
        try {
            const res = await fetch(`${TWITCH_API_BASE}/eventsub/subscriptions?id=${subId}`, {
                method: "DELETE",
                headers: {
                    "Authorization": `Bearer ${accessToken}`,
                    "Client-Id": clientId,
                },
            });
            return res.ok;
        } catch (err) {
            logger.warn(`[TwitchApi] Failed to revoke subscription ${subId}: ${err}`);
            return false;
        }
    }

    async fetchChannelRewards(accessToken: string, userId: string): Promise<NormalizedChannelReward[]> {
        const res = await fetch(`${TWITCH_API_BASE}/channel_points/custom_rewards?broadcaster_id=${userId}`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Client-Id": this.config.clientId,
            },
        });

        if (!res.ok) {
            const body = await res.text();
            logger.error(`[TwitchApi] Failed to fetch channel rewards: ${res.status} - ${body}`);
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

export const twitchApiService = new TwitchApiService();
