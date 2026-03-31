import { env } from "@/lib/env";
import { BadGatewayError } from "@/lib/errors";
import type { IProviderApiService, OAuthTokenResponse, OAuthUserInfo } from "../types";

export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const YOUTUBE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

export class YouTubeApiService implements IProviderApiService {
    public readonly provider = "youtube";

    private readonly config = {
        clientId: env.GOOGLE_CLIENT_ID!,
        clientSecret: env.GOOGLE_CLIENT_SECRET!,
        redirectUri: env.GOOGLE_REDIRECT_URI!,
        loginScopes: ["openid", "email", "profile"],
        connectScopes: [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/youtube.readonly",
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
            access_type: "offline",
            prompt: "consent",
        });
        return `${GOOGLE_AUTH_URL}?${params.toString()}`;
    }

    async exchangeCode(code: string): Promise<OAuthTokenResponse> {
        const res = await fetch(GOOGLE_TOKEN_URL, {
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
            throw new BadGatewayError(`YouTube token exchange failed: ${body}`);
        }

        return res.json() as Promise<OAuthTokenResponse>;
    }

    async refresh(refreshToken: string): Promise<OAuthTokenResponse> {
        const res = await fetch(GOOGLE_TOKEN_URL, {
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
            throw new BadGatewayError(`YouTube token refresh failed: ${body}`);
        }

        return res.json() as Promise<OAuthTokenResponse>;
    }

    async fetchUser(accessToken: string): Promise<OAuthUserInfo> {
        const res = await fetch(YOUTUBE_USERINFO_URL, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        if (!res.ok) {
            const body = await res.text();
            throw new BadGatewayError(`Failed to fetch YouTube user info: ${body}`);
        }

        const data = await res.json() as {
            id: string;
            name?: string;
            email?: string;
            picture?: string;
        };
        return {
            providerUserId: data.id,
            providerUsername: data.name || data.email || "Unknown user",
            providerAvatarUrl: data.picture,
        };
    }

    getCacheTtlSeconds(): number {
        return 5 * 60;
    }
}

export const youtubeApiService = new YouTubeApiService();
