import { env } from "@/lib/env";
import { BadGatewayError } from "@/lib/errors";
import type { IProviderApiService, OAuthTokenResponse, OAuthUserInfo } from "../types";

export const KICK_AUTH_URL = "https://id.kick.com/oauth2/authorize";
export const KICK_TOKEN_URL = "https://id.kick.com/oauth2/token";
export const KICK_API_BASE = "https://kick.com/api/v1";

export class KickApiService implements IProviderApiService {
    public readonly provider = "kick";

    private readonly config = {
        clientId: env.KICK_CLIENT_ID!,
        clientSecret: env.KICK_CLIENT_SECRET!,
        redirectUri: env.KICK_REDIRECT_URI!,
        loginScopes: ["user:read"],
        connectScopes: ["user:read", "channel:read"],
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
        return `${KICK_AUTH_URL}?${params.toString()}`;
    }

    async exchangeCode(code: string): Promise<OAuthTokenResponse> {
        const res = await fetch(KICK_TOKEN_URL, {
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
            throw new BadGatewayError(`Kick token exchange failed: ${body}`);
        }

        return res.json() as Promise<OAuthTokenResponse>;
    }

    async refresh(refreshToken: string): Promise<OAuthTokenResponse> {
        const res = await fetch(KICK_TOKEN_URL, {
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
            throw new BadGatewayError(`Kick token refresh failed: ${body}`);
        }

        return res.json() as Promise<OAuthTokenResponse>;
    }

    async fetchUser(accessToken: string): Promise<OAuthUserInfo> {
        const res = await fetch(`${KICK_API_BASE}/user`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!res.ok) {
            const body = await res.text();
            throw new BadGatewayError(`Failed to fetch Kick user: ${body}`);
        }

        const data = await res.json() as {
            id: number;
            username: string;
            profile_pic?: string;
        };
        return {
            providerUserId: String(data.id),
            providerUsername: data.username,
            providerAvatarUrl: data.profile_pic,
        };
    }

    getCacheTtlSeconds(): number {
        return 5 * 60;
    }
}

export const kickApiService = new KickApiService();
