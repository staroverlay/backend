import { eq, and } from "drizzle-orm";

import { db } from "@/database";
import { integrations } from "@/database/schema";
import {
    oauthProviders,
    buildAuthUrl,
    exchangeCode,
    fetchProviderUser,
    refreshProviderToken,
    type OAuthProvider,
    type OAuthTokenResponse,
    type OAuthUserInfo,
} from "@/services/oauth.service";
import { redis } from "@/database/redis";
import { createSession } from "@/services/auth.service";
import {
    BadGatewayError,
    BadRequestError,
    ForbiddenError,
    InternalServerError,
    NotFoundError
} from "@/lib/errors";

const OAUTH_STATE_TTL = 600; // 10 minutes

export type IntegrationProvider = "twitch" | "kick" | "youtube";

export interface IntegrationSafe {
    id: string;
    provider: string;
    displayName: string | null;
    providerUsername: string;
    providerUserId: string;
    providerAvatarUrl: string | null;
    allowOauthLogin: boolean;
    tokenExpiresAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

function getOAuthLoginMethod(provider: OAuthProvider) {
    switch (provider) {
        case "twitch": return "oauth_twitch" as const;
        case "kick": return "oauth_kick" as const;
        case "youtube": return "oauth_youtube" as const;
    }
}

export async function initiateOAuthLogin(provider: OAuthProvider): Promise<{ url: string }> {
    if (!oauthProviders[provider]) {
        throw new BadRequestError(`Provider ${provider} is not configured or supported`);
    }

    const state = `login:${crypto.randomUUID()}`;
    await redis.setex(
        `oauth:state:${state}`,
        OAUTH_STATE_TTL,
        JSON.stringify({ type: "login" })
    );
    const url = buildAuthUrl(provider, state, "login");
    return { url };
}

export async function initiateOAuthConnect(
    userId: string,
    provider: OAuthProvider
): Promise<{ url: string }> {
    if (!oauthProviders[provider]) {
        throw new BadRequestError(`Provider ${provider} is not configured or supported`);
    }

    const state = `connect:${userId}:${crypto.randomUUID()}`;
    await redis.setex(
        `oauth:state:${state}`,
        OAUTH_STATE_TTL,
        JSON.stringify({ type: "connect", userId })
    );
    const url = buildAuthUrl(provider, state, "connect");
    return { url };
}

// OAuth Callback

export interface OAuthCallbackResult {
    type: "login";
    accessToken: string;
    refreshToken: string;
    accessExpiresAt: Date;
    refreshExpiresAt: Date;
}

export interface OAuthConnectResult {
    type: "connect";
    provider: string;
    username: string;
}

export async function handleOAuthCallback(
    provider: OAuthProvider,
    code: string,
    state: string,
    meta: { ipAddress?: string; userAgent?: string }
): Promise<OAuthCallbackResult | OAuthConnectResult> {
    const config = oauthProviders[provider];
    if (!config) {
        throw new BadRequestError(`Provider ${provider} is not configured or supported`);
    }

    // Validate state
    const stateKey = `oauth:state:${state}`;
    const stateRaw = await redis.get(stateKey);
    if (!stateRaw) {
        throw new BadRequestError("Invalid or expired OAuth state");
    }
    await redis.del(stateKey);

    const stateData = JSON.parse(stateRaw) as {
        type: "login" | "connect";
        userId?: string;
    };

    // Exchange code for tokens
    let tokens: OAuthTokenResponse;
    try {
        tokens = await exchangeCode(provider, code);
    } catch (e: any) {
        throw new BadGatewayError(e.message);
    }

    const tokenExpiresAt = tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000)
        : null;

    // Fetch provider user info
    let providerUser: OAuthUserInfo;
    try {
        providerUser = await fetchProviderUser(provider, tokens.access_token);
    } catch {
        throw new BadGatewayError(`Failed to fetch user from ${provider}`);
    }

    // CONNECT FLOW
    if (stateData.type === "connect" && stateData.userId) {
        await upsertIntegration(stateData.userId, provider, tokens, tokenExpiresAt, providerUser);
        return {
            type: "connect",
            provider,
            username: providerUser.providerUsername,
        };
    }

    // LOGIN FLOW
    const [integration] = await db
        .select()
        .from(integrations)
        .where(
            and(
                eq(integrations.provider, provider),
                eq(integrations.providerUserId, providerUser.providerUserId)
            )
        )
        .limit(1);

    if (!integration) {
        throw new NotFoundError("No account linked to this provider account");
    }

    if (!integration.allowOauthLogin) {
        throw new ForbiddenError(`OAuth login via ${provider} is disabled for this account`);
    }

    // Update stored tokens
    await db
        .update(integrations)
        .set({
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token ?? integration.refreshToken,
            tokenExpiresAt,
            providerUsername: providerUser.providerUsername,
            providerAvatarUrl: providerUser.providerAvatarUrl,
            updatedAt: new Date(),
        })
        .where(eq(integrations.id, integration.id));

    const sessionTokens = await createSession(
        integration.userId,
        getOAuthLoginMethod(provider),
        meta
    );

    return { type: "login", ...sessionTokens };
}

// Integration CRUD

export async function listIntegrations(userId: string): Promise<IntegrationSafe[]> {
    return db
        .select({
            id: integrations.id,
            provider: integrations.provider,
            displayName: integrations.displayName,
            providerUsername: integrations.providerUsername,
            providerUserId: integrations.providerUserId,
            providerAvatarUrl: integrations.providerAvatarUrl,
            allowOauthLogin: integrations.allowOauthLogin,
            tokenExpiresAt: integrations.tokenExpiresAt,
            createdAt: integrations.createdAt,
            updatedAt: integrations.updatedAt,
        })
        .from(integrations)
        .where(eq(integrations.userId, userId));
}

export async function getIntegration(
    userId: string,
    provider: IntegrationProvider
): Promise<IntegrationSafe> {
    const [integration] = await db
        .select()
        .from(integrations)
        .where(
            and(
                eq(integrations.userId, userId),
                eq(integrations.provider, provider)
            )
        )
        .limit(1);

    if (!integration) {
        throw new NotFoundError("Integration not found");
    }

    const { accessToken, refreshToken, ...safe } = integration;
    return safe;
}

export interface UpdateIntegrationInput {
    displayName?: string | null;
    allowOauthLogin?: boolean;
}

export async function updateIntegration(
    userId: string,
    provider: IntegrationProvider,
    input: UpdateIntegrationInput
): Promise<IntegrationSafe> {
    const [existing] = await db
        .select({ id: integrations.id })
        .from(integrations)
        .where(
            and(
                eq(integrations.userId, userId),
                eq(integrations.provider, provider)
            )
        )
        .limit(1);

    if (!existing) {
        throw new NotFoundError("Integration not found");
    }

    const updates: Partial<typeof integrations.$inferInsert> = {
        updatedAt: new Date(),
    };
    if (input.displayName !== undefined) updates.displayName = input.displayName;
    if (input.allowOauthLogin !== undefined) updates.allowOauthLogin = input.allowOauthLogin;

    const [updated] = await db
        .update(integrations)
        .set(updates)
        .where(eq(integrations.id, existing.id))
        .returning({
            id: integrations.id,
            provider: integrations.provider,
            displayName: integrations.displayName,
            providerUsername: integrations.providerUsername,
            providerUserId: integrations.providerUserId,
            providerAvatarUrl: integrations.providerAvatarUrl,
            allowOauthLogin: integrations.allowOauthLogin,
            tokenExpiresAt: integrations.tokenExpiresAt,
            createdAt: integrations.createdAt,
            updatedAt: integrations.updatedAt,
        });

    if (!updated) throw new InternalServerError("Failed to update integration");

    return updated;
}

export async function disconnectIntegration(
    userId: string,
    provider: IntegrationProvider
): Promise<void> {
    const result = await db
        .delete(integrations)
        .where(
            and(
                eq(integrations.userId, userId),
                eq(integrations.provider, provider)
            )
        )
        .returning({ id: integrations.id });

    if (result.length === 0) {
        throw new NotFoundError("Integration not found");
    }
}

export async function refreshIntegration(
    userId: string,
    provider: IntegrationProvider
): Promise<{ tokenExpiresAt: Date | null }> {
    const [integration] = await db
        .select()
        .from(integrations)
        .where(
            and(
                eq(integrations.userId, userId),
                eq(integrations.provider, provider)
            )
        )
        .limit(1);

    if (!integration) {
        throw new NotFoundError("Integration not found");
    }

    if (!integration.refreshToken) {
        throw new BadRequestError("No refresh token available");
    }

    const tokens = await refreshProviderToken(provider, integration.refreshToken);

    const tokenExpiresAt = tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000)
        : null;

    const providerUser = await fetchProviderUser(provider, tokens.access_token);

    await db
        .update(integrations)
        .set({
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token ?? integration.refreshToken,
            tokenExpiresAt,
            providerUsername: providerUser.providerUsername,
            providerAvatarUrl: providerUser.providerAvatarUrl,
            updatedAt: new Date(),
        })
        .where(eq(integrations.id, integration.id));

    return { tokenExpiresAt };
}

// Internal helpers

async function upsertIntegration(
    userId: string,
    provider: OAuthProvider,
    tokens: OAuthTokenResponse,
    tokenExpiresAt: Date | null,
    providerUser: OAuthUserInfo
): Promise<void> {
    const existing = await db
        .select({ id: integrations.id })
        .from(integrations)
        .where(
            and(
                eq(integrations.userId, userId),
                eq(integrations.provider, provider)
            )
        )
        .limit(1);

    if (existing.length > 0) {
        await db
            .update(integrations)
            .set({
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token ?? null,
                tokenExpiresAt,
                providerUsername: providerUser.providerUsername,
                providerUserId: providerUser.providerUserId,
                providerAvatarUrl: providerUser.providerAvatarUrl,
                updatedAt: new Date(),
            })
            .where(eq(integrations.id, existing[0]!.id));
    } else {
        await db.insert(integrations).values({
            userId,
            provider,
            providerUsername: providerUser.providerUsername,
            providerUserId: providerUser.providerUserId,
            providerAvatarUrl: providerUser.providerAvatarUrl,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token ?? null,
            tokenExpiresAt,
            allowOauthLogin: false,
        });
    }
}
