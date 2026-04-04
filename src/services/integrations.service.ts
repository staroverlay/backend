import { eq, and } from "drizzle-orm";

import { db } from "@/database";
import { integrations } from "@/database/schema";
import { redis } from "@/database/redis";
import { createSession } from "@/services/auth.service";
import { encrypt, decrypt } from "@/lib/crypto";
import {
    BadGatewayError,
    BadRequestError,
    ForbiddenError,
    InternalServerError,
    NotFoundError
} from "@/lib/errors";
import { getAccessToken, providersMap } from "./token-manager.service";
import type { OAuthTokenResponse, OAuthUserInfo, NormalizedChannelReward } from "@/apis/types";

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

function getOAuthLoginMethod(provider: IntegrationProvider) {
    switch (provider) {
        case "twitch": return "oauth_twitch" as const;
        case "kick": return "oauth_kick" as const;
        case "youtube": return "oauth_youtube" as const;
    }
}

export async function initiateOAuthLogin(provider: IntegrationProvider): Promise<{ url: string }> {
    const service = providersMap[provider];
    if (!service) {
        throw new BadRequestError(`Provider ${provider} is not configured or supported`);
    }

    const state = `login:${crypto.randomUUID()}`;
    await redis.setex(
        `oauth:state:${state}`,
        OAUTH_STATE_TTL,
        JSON.stringify({ type: "login" })
    );
    const url = service.getAuthUrl(state, "login");
    return { url };
}

export async function initiateOAuthConnect(
    userId: string,
    provider: IntegrationProvider
): Promise<{ url: string }> {
    const service = providersMap[provider];
    if (!service) {
        throw new BadRequestError(`Provider ${provider} is not configured or supported`);
    }

    const state = `connect:${userId}:${crypto.randomUUID()}`;
    await redis.setex(
        `oauth:state:${state}`,
        OAUTH_STATE_TTL,
        JSON.stringify({ type: "connect", userId })
    );
    const url = service.getAuthUrl(state, "connect");
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
    provider: IntegrationProvider,
    code: string,
    state: string,
    meta: { ipAddress?: string; userAgent?: string }
): Promise<OAuthCallbackResult | OAuthConnectResult> {
    const service = providersMap[provider];
    if (!service) {
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
        tokens = await service.exchangeCode(code);
    } catch (e: any) {
        throw new BadGatewayError(e.message);
    }

    const tokenExpiresAt = tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000)
        : null;

    let providerUser: OAuthUserInfo;
    try {
        providerUser = await service.fetchUser(tokens.access_token);
    } catch (e: any) {
        throw new BadGatewayError(`Failed to fetch user from ${provider}: ${e.message}`);
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
            accessToken: encrypt(tokens.access_token),
            refreshToken: tokens.refresh_token
                ? encrypt(tokens.refresh_token)
                : integration.refreshToken, // already encrypted
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
    const rows = await db
        .select()
        .from(integrations)
        .where(eq(integrations.userId, userId));

    return rows.map(i => ({
        id: `${i.provider}:${i.userId}:${i.providerUserId}`,
        provider: i.provider,
        displayName: i.displayName || i.providerUsername,
        providerUsername: i.providerUsername,
        providerUserId: i.providerUserId,
        providerAvatarUrl: i.providerAvatarUrl,
        allowOauthLogin: i.allowOauthLogin,
        tokenExpiresAt: i.tokenExpiresAt,
        createdAt: i.createdAt,
        updatedAt: i.updatedAt,
    }));
}

export async function getIntegration(
    userId: string,
    provider: IntegrationProvider
): Promise<IntegrationSafe> {
    const [i] = await db
        .select()
        .from(integrations)
        .where(
            and(
                eq(integrations.userId, userId),
                eq(integrations.provider, provider)
            )
        )
        .limit(1);

    if (!i) {
        throw new NotFoundError("Integration not found");
    }

    return {
        id: `${i.provider}:${i.userId}:${i.providerUserId}`,
        provider: i.provider,
        displayName: i.displayName || i.providerUsername,
        providerUsername: i.providerUsername,
        providerUserId: i.providerUserId,
        providerAvatarUrl: i.providerAvatarUrl,
        allowOauthLogin: i.allowOauthLogin,
        tokenExpiresAt: i.tokenExpiresAt,
        createdAt: i.createdAt,
        updatedAt: i.updatedAt,
    };
}

export async function getChannelRewards(
    userId: string,
    provider: IntegrationProvider
): Promise<NormalizedChannelReward[]> {
    const [integration] = await db
        .select({
            id: integrations.id,
            provider: integrations.provider,
            providerUserId: integrations.providerUserId,
        })
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

    const service = providersMap[integration.provider];
    if (!service) {
        throw new InternalServerError(`Provider API handler for "${integration.provider}" not implemented.`);
    }

    const accessToken = await getAccessToken(integration.id);
    return service.fetchChannelRewards(accessToken, integration.providerUserId);
}

export async function getChannelRewardsById(
    userId: string,
    integrationId: string
): Promise<NormalizedChannelReward[]> {
    const parts = integrationId.split(":");
    let filter;

    if (parts.length === 3) {
        const [provider, uid, puid] = parts;
        filter = and(
            eq(integrations.userId, userId),
            eq(integrations.provider, provider as IntegrationProvider),
            eq(integrations.providerUserId, puid!)
        );
    } else {
        filter = and(
            eq(integrations.userId, userId),
            eq(integrations.id, integrationId)
        );
    }

    const [integration] = await db
        .select({
            id: integrations.id,
            provider: integrations.provider,
            providerUserId: integrations.providerUserId,
        })
        .from(integrations)
        .where(filter)
        .limit(1);

    if (!integration) {
        throw new NotFoundError("Integration not found");
    }

    const service = providersMap[integration.provider];
    if (!service) {
        throw new InternalServerError(`Provider API handler for "${integration.provider}" not implemented.`);
    }

    const accessToken = await getAccessToken(integration.id);
    return service.fetchChannelRewards(accessToken, integration.providerUserId);
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
            userId: integrations.userId,
        });

    if (!updated) throw new InternalServerError("Failed to update integration");

    return {
        ...updated,
        id: `${updated.provider}:${updated.userId}:${updated.providerUserId}`,
    } as any;
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
        .select({ id: integrations.id })
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

    // Force refresh/get via token manager (handles encryption, decryption, and redis)
    await getAccessToken(integration.id);

    // Fetch the updated expiry to return it
    const [updated] = await db
        .select({ tokenExpiresAt: integrations.tokenExpiresAt })
        .from(integrations)
        .where(eq(integrations.id, integration.id))
        .limit(1);

    return { tokenExpiresAt: updated?.tokenExpiresAt ?? null };
}

// Internal helpers

async function upsertIntegration(
    userId: string,
    provider: IntegrationProvider,
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
                accessToken: encrypt(tokens.access_token),
                refreshToken: encrypt(tokens.refresh_token ?? null),
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
            accessToken: encrypt(tokens.access_token),
            refreshToken: encrypt(tokens.refresh_token ?? null),
            tokenExpiresAt,
            allowOauthLogin: false,
        });
    }
}
