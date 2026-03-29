import { env } from "@/lib/env";
import { InternalServerError, BadGatewayError } from "@/lib/errors";

export type OAuthProvider = "twitch" | "kick" | "youtube";

export interface OAuthConfig {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    authUrl: string;
    tokenUrl: string;
    loginScopes: string[];
    connectScopes: string[];
}

export interface OAuthTokenResponse {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    token_type: string;
}

export interface OAuthUserInfo {
    providerUserId: string;
    providerUsername: string;
    providerAvatarUrl?: string;
}

// Provider configs

export const oauthProviders: Record<OAuthProvider, OAuthConfig | null> = {
    twitch: env.TWITCH_CLIENT_ID
        ? {
            clientId: env.TWITCH_CLIENT_ID!,
            clientSecret: env.TWITCH_CLIENT_SECRET!,
            redirectUri: env.TWITCH_REDIRECT_URI!,
            authUrl: "https://id.twitch.tv/oauth2/authorize",
            tokenUrl: "https://id.twitch.tv/oauth2/token",
            loginScopes: ["user:read:email"],
            connectScopes: ["user:read:email", "channel:read:redemptions", "channel:read:subscriptions", "moderator:read:followers"],
        }
        : null,

    kick: env.KICK_CLIENT_ID
        ? {
            clientId: env.KICK_CLIENT_ID!,
            clientSecret: env.KICK_CLIENT_SECRET!,
            redirectUri: env.KICK_REDIRECT_URI!,
            authUrl: "https://id.kick.com/oauth2/authorize",
            tokenUrl: "https://id.kick.com/oauth2/token",
            loginScopes: ["user:read"],
            connectScopes: ["user:read", "channel:read"],
        }
        : null,

    youtube: env.GOOGLE_CLIENT_ID
        ? {
            clientId: env.GOOGLE_CLIENT_ID!,
            clientSecret: env.GOOGLE_CLIENT_SECRET!,
            redirectUri: env.GOOGLE_REDIRECT_URI!,
            authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
            tokenUrl: "https://oauth2.googleapis.com/token",
            loginScopes: ["openid", "email", "profile"],
            connectScopes: [
                "openid",
                "email",
                "profile",
                "https://www.googleapis.com/auth/youtube.readonly",
            ],
        }
        : null,
};

// Build authorization URL

export function buildAuthUrl(
    provider: OAuthProvider,
    state: string,
    type: "login" | "connect",
    extra?: Record<string, string>
): string {
    const config = oauthProviders[provider];
    if (!config) throw new InternalServerError(`Provider ${provider} not configured`);

    const scopes = type === "login" ? config.loginScopes : config.connectScopes;

    const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        response_type: "code",
        scope: scopes.join(" "),
        state,
        ...extra,
    });

    return `${config.authUrl}?${params}`;
}

// Exchange code for tokens

export async function exchangeCode(
    provider: OAuthProvider,
    code: string
): Promise<OAuthTokenResponse> {
    const config = oauthProviders[provider];
    if (!config) throw new InternalServerError(`Provider ${provider} not configured`);

    const res = await fetch(config.tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            grant_type: "authorization_code",
            code,
            redirect_uri: config.redirectUri,
            client_id: config.clientId,
            client_secret: config.clientSecret,
        }),
    });

    if (!res.ok) {
        const body = await res.text();
        throw new BadGatewayError(`OAuth token exchange failed for ${provider}: ${body}`);
    }

    return res.json() as Promise<OAuthTokenResponse>;
}

// Refresh provider token

export async function refreshProviderToken(
    provider: OAuthProvider,
    refreshToken: string
): Promise<OAuthTokenResponse> {
    const config = oauthProviders[provider];
    if (!config) throw new InternalServerError(`Provider ${provider} not configured`);

    const res = await fetch(config.tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: refreshToken,
            client_id: config.clientId,
            client_secret: config.clientSecret,
        }),
    });

    if (!res.ok) throw new BadGatewayError(`Provider token refresh failed for ${provider}`);
    return res.json() as Promise<OAuthTokenResponse>;
}

// Fetch user info from provider

export async function fetchProviderUser(
    provider: OAuthProvider,
    accessToken: string
): Promise<OAuthUserInfo> {
    switch (provider) {
        case "twitch":
            return fetchTwitchUser(accessToken);
        case "kick":
            return fetchKickUser(accessToken);
        case "youtube":
            return fetchYouTubeUser(accessToken);
    }
}

async function fetchTwitchUser(accessToken: string): Promise<OAuthUserInfo> {
    const config = oauthProviders["twitch"]!;
    const res = await fetch("https://api.twitch.tv/helix/users", {
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Client-Id": config.clientId,
        },
    });
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

async function fetchKickUser(accessToken: string): Promise<OAuthUserInfo> {
    const res = await fetch("https://kick.com/api/v1/user", {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
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

async function fetchYouTubeUser(accessToken: string): Promise<OAuthUserInfo> {
    const res = await fetch(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        { headers: { Authorization: `Bearer ${accessToken}` } }
    );
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