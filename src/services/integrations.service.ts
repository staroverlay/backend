import { eq, and, or, exists } from "drizzle-orm";

import { db } from "@/database";
import { integrations, profiles, widgets, widgetIntegrations } from "@/database/schema";
import { redis } from "@/database/redis";
import { createSession } from "@/services/auth.service";
import { encrypt } from "@/lib/crypto";
import { logger } from "@/logger";
import {
    BadGatewayError,
    BadRequestError,
    ForbiddenError,
    InternalServerError,
    NotFoundError
} from "@/lib/errors";
import { getAccessToken, providersMap } from "./token-manager.service";
import type { OAuthTokenResponse, OAuthUserInfo, NormalizedChannelReward } from "@/apis/types";
import { IntegrationWebhookService } from "./integration-webhook.service";

const OAUTH_STATE_TTL = 600; // 10 minutes

export type IntegrationProvider = "twitch" | "kick" | "youtube";

export interface IntegrationSafe {
    id: string;
    integrationId: string;
    provider: string;
    displayName: string | null;
    providerUsername: string;
    providerUserId: string;
    providerAvatarUrl: string | null;
    allowOauthLogin: boolean;
    isActive: boolean;
    lastUsedAt: Date | null;
    tokenExpiresAt: Date | null;
    eventsubActive: boolean;
    eventsubSyncError: string | null;
    eventsubLastSyncAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Private helper: maps a raw DB integration row to the public-safe shape.
// Centralises the mapping to avoid repeating it in list / get / update.
// ---------------------------------------------------------------------------

type IntegrationRow = typeof integrations.$inferSelect;

function toIntegrationSafe(i: IntegrationRow): IntegrationSafe {
    return {
        id: `${i.provider}:${i.id}:${i.providerUserId}`,
        integrationId: i.id,
        provider: i.provider,
        displayName: i.displayName || i.providerUsername,
        providerUsername: i.providerUsername,
        providerUserId: i.providerUserId,
        providerAvatarUrl: i.providerAvatarUrl,
        allowOauthLogin: i.allowOauthLogin,
        isActive: i.isActive,
        lastUsedAt: i.lastUsedAt,
        tokenExpiresAt: i.tokenExpiresAt,
        eventsubActive: i.eventsubActive,
        eventsubSyncError: i.eventsubSyncError,
        eventsubLastSyncAt: i.eventsubLastSyncAt,
        createdAt: i.createdAt,
        updatedAt: i.updatedAt,
    };
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
    profileId: string,
    provider: IntegrationProvider
): Promise<{ url: string }> {
    const service = providersMap[provider];
    if (!service) {
        throw new BadRequestError(`Provider ${provider} is not configured or supported`);
    }

    const state = `connect:${profileId}:${crypto.randomUUID()}`;
    await redis.setex(
        `oauth:state:${state}`,
        OAUTH_STATE_TTL,
        JSON.stringify({ type: "connect", profileId })
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
        profileId?: string;
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
    if (stateData.type === "connect" && stateData.profileId) {
        await upsertIntegration(stateData.profileId, provider, tokens, tokenExpiresAt, providerUser);
        return {
            type: "connect",
            provider,
            username: providerUser.providerUsername,
        };
    }

    // LOGIN FLOW – find integration by provider + providerUserId
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
            lastUsedAt: new Date(),
            updatedAt: new Date(),
        })
        .where(eq(integrations.id, integration.id));

    // Resolve the user who owns this profile for session creation
    const [profileRow] = await db
        .select({ userId: profiles.userId })
        .from(profiles)
        .where(eq(profiles.id, integration.profileId))
        .limit(1);

    if (!profileRow) {
        throw new InternalServerError("Profile owner not found");
    }

    const sessionTokens = await createSession(
        profileRow.userId,
        getOAuthLoginMethod(provider),
        meta
    );

    return { type: "login", ...sessionTokens };
}

// Integration CRUD

export async function listIntegrations(profileId: string): Promise<IntegrationSafe[]> {
    const rows = await db
        .select()
        .from(integrations)
        .where(eq(integrations.profileId, profileId));

    return rows.map(toIntegrationSafe);
}

export async function getIntegration(
    profileId: string,
    provider: IntegrationProvider
): Promise<IntegrationSafe> {
    const [i] = await db
        .select()
        .from(integrations)
        .where(
            and(
                eq(integrations.profileId, profileId),
                eq(integrations.provider, provider)
            )
        )
        .limit(1);

    if (!i) {
        throw new NotFoundError("Integration not found");
    }

    return toIntegrationSafe(i);
}

export async function getChannelRewards(
    profileId: string,
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
                eq(integrations.profileId, profileId),
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
    profileId: string,
    integrationId: string
): Promise<NormalizedChannelReward[]> {
    const parts = integrationId.split(":");
    let filter;

    if (parts.length === 3) {
        const [_, pid, __] = parts;
        filter = eq(integrations.id, pid!);
    } else {
        filter = eq(integrations.id, integrationId);
    }

    const [integration] = await db
        .select()
        .from(integrations)
        .where(filter)
        .limit(1);

    if (!integration) {
        throw new NotFoundError("Integration not found");
    }

    // Permission check: Current user must OWN the integration
    // OR OWN a widget that is linked to this integration.
    if (integration.profileId !== profileId) {
        const [accessProof] = await db
            .select({ id: widgets.id })
            .from(widgets)
            .innerJoin(widgetIntegrations, eq(widgets.id, widgetIntegrations.widgetId))
            .where(
                and(
                    eq(widgets.profileId, profileId),
                    eq(widgetIntegrations.integrationId, integration.id)
                )
            )
            .limit(1);

        if (!accessProof) {
            throw new ForbiddenError("You do not have permission to access this integration's rewards.");
        }
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
    isActive?: boolean;
}

export async function updateIntegration(
    profileId: string,
    provider: IntegrationProvider,
    input: UpdateIntegrationInput
): Promise<IntegrationSafe> {
    const [existing] = await db
        .select({ id: integrations.id })
        .from(integrations)
        .where(
            and(
                eq(integrations.profileId, profileId),
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
    if (input.isActive !== undefined) updates.isActive = input.isActive;

    const [updated] = await db
        .update(integrations)
        .set(updates)
        .where(eq(integrations.id, existing.id))
        .returning();

    if (!updated) throw new InternalServerError("Failed to update integration");

    return toIntegrationSafe(updated);
}

export async function disconnectIntegration(
    profileId: string,
    provider: IntegrationProvider
): Promise<void> {
    const [integration] = await db
        .select()
        .from(integrations)
        .where(
            and(
                eq(integrations.profileId, profileId),
                eq(integrations.provider, provider)
            )
        )
        .limit(1);

    if (!integration) {
        throw new NotFoundError("Integration not found");
    }

    // Delete subscriptions first
    await IntegrationWebhookService.deleteSubscriptions(integration);

    await db
        .delete(integrations)
        .where(eq(integrations.id, integration.id));
}

export async function refreshIntegration(
    profileId: string,
    provider: IntegrationProvider
): Promise<{ tokenExpiresAt: Date | null }> {
    const [integration] = await db
        .select({ id: integrations.id })
        .from(integrations)
        .where(
            and(
                eq(integrations.profileId, profileId),
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

export async function syncIntegrationWebhooks(
    profileId: string,
    provider: IntegrationProvider
): Promise<void> {
    const [integration] = await db
        .select({ id: integrations.id })
        .from(integrations)
        .where(
            and(
                eq(integrations.profileId, profileId),
                eq(integrations.provider, provider)
            )
        )
        .limit(1);

    if (!integration) {
        throw new NotFoundError("Integration not found");
    }

    // Call webhook service to recreate/sync
    await IntegrationWebhookService.createSubscriptions(integration.id);
}

// Internal helpers

async function upsertIntegration(
    profileId: string,
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
                eq(integrations.profileId, profileId),
                eq(integrations.provider, provider)
            )
        )
        .limit(1);

    if (existing.length > 0) {
        const id = existing[0]!.id;
        await db
            .update(integrations)
            .set({
                accessToken: encrypt(tokens.access_token),
                refreshToken: encrypt(tokens.refresh_token ?? null),
                tokenExpiresAt,
                providerUsername: providerUser.providerUsername,
                providerUserId: providerUser.providerUserId,
                providerAvatarUrl: providerUser.providerAvatarUrl,
                lastUsedAt: new Date(),
                updatedAt: new Date(),
            })
            .where(eq(integrations.id, id));

        // Create webhooks asynchronously (fire-and-forget)
        IntegrationWebhookService.createSubscriptions(id).catch((err) =>
            logger.error({ err }, `Failed to create webhooks for integration ${id}`)
        );
    } else {
        const [inserted] = await db.insert(integrations).values({
            profileId,
            provider,
            providerUsername: providerUser.providerUsername,
            providerUserId: providerUser.providerUserId,
            providerAvatarUrl: providerUser.providerAvatarUrl,
            accessToken: encrypt(tokens.access_token),
            refreshToken: encrypt(tokens.refresh_token ?? null),
            tokenExpiresAt,
            allowOauthLogin: false,
            isActive: true,
        }).returning({ id: integrations.id });

        if (inserted) {
            // Create webhooks asynchronously (fire-and-forget)
            IntegrationWebhookService.createSubscriptions(inserted.id).catch((err) =>
                logger.error({ err }, `Failed to create webhooks for integration ${inserted.id}`)
            );
        }
    }
}
