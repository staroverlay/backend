import { eq } from "drizzle-orm";
import { db } from "@/database";
import { integrations } from "@/database/schema";
import { redis, redisKeys } from "@/database/redis";
import { encrypt, decrypt } from "@/lib/crypto";
import { twitchApiService } from "@/apis/twitch/service";
import { kickApiService } from "@/apis/kick/service";
import { youtubeApiService } from "@/apis/youtube/service";
import type { IProviderApiService } from "@/apis/types";
import { BadRequestError, InternalServerError, NotFoundError } from "@/lib/errors";

export const providersMap: Record<string, IProviderApiService> = {
    twitch: twitchApiService,
    kick: kickApiService,
    youtube: youtubeApiService,
};

/**
 * Centrally manages OAuth access tokens with Redis caching and decryption.
 * All cached tokens are encrypted using OAUTH_ENCRYPTION_KEY.
 */
export async function getAccessToken(integrationId: string): Promise<string> {
    const redisKey = redisKeys.accessToken(integrationId);

    // 1. Redis first (Check cache)
    const cachedEncryptedToken = await redis.get(redisKey);
    if (cachedEncryptedToken) {
        const decryptedToken = decrypt(cachedEncryptedToken);
        if (decryptedToken) return decryptedToken;
        console.warn(`Redis cache for ${integrationId} failed decryption. Falling back to DB.`);
    }

    // 2. Fetch from DB
    const [integration] = await db
        .select()
        .from(integrations)
        .where(eq(integrations.id, integrationId))
        .limit(1);

    if (!integration) throw new NotFoundError("Integration not found");

    const providerHandle = providersMap[integration.provider];
    if (!providerHandle) {
        throw new InternalServerError(`Provider API handler for "${integration.provider}" not implemented.`);
    }

    // 3. Check if current access token is valid and not expired
    const now = new Date();
    const expiresAt = integration.tokenExpiresAt;

    // If it exists and hasn't expired (leave a 30s buffer), try using it.
    if (integration.accessToken && (!expiresAt || expiresAt.getTime() > now.getTime() + 30000)) {
        const decryptedVal = decrypt(integration.accessToken);
        if (decryptedVal) {
            // Re-cache in redis before returning
            await cacheInRedis(integrationId, decryptedVal, providerHandle.getCacheTtlSeconds());
            return decryptedVal;
        }
    }

    // 4. Token is expired or decryption failed - Refresh it.
    if (!integration.refreshToken) {
        throw new BadRequestError(`No refresh token available for integration ${integrationId} (${integration.provider})`);
    }

    const decryptedRefreshToken = decrypt(integration.refreshToken);
    if (!decryptedRefreshToken) {
        throw new InternalServerError(`Failed to decrypt refresh token for ${integrationId}`);
    }

    try {
        const tokens = await providerHandle.refresh(decryptedRefreshToken);

        const newAccessToken = tokens.access_token;
        const newRefreshToken = tokens.refresh_token; // May rotate
        const expires_in = tokens.expires_in; // In seconds

        const newTokenExpiresAt = expires_in ? new Date(Date.now() + expires_in * 1000) : null;

        // 5. Update Database
        await db
            .update(integrations)
            .set({
                accessToken: encrypt(newAccessToken),
                refreshToken: newRefreshToken ? encrypt(newRefreshToken) : integration.refreshToken,
                tokenExpiresAt: newTokenExpiresAt,
                updatedAt: new Date(),
            })
            .where(eq(integrations.id, integrationId));

        // 6. Cache in Redis
        await cacheInRedis(integrationId, newAccessToken, providerHandle.getCacheTtlSeconds());

        return newAccessToken;
    } catch (e: any) {
        console.error(`Token refresh failed for ${integrationId} (${integration.provider}):`, e);
        throw new InternalServerError(`Failed to refresh access token: ${e.message}`);
    }
}

async function cacheInRedis(integrationId: string, accessToken: string, ttlSeconds: number) {
    const encryptedTokenForRedis = encrypt(accessToken);
    if (!encryptedTokenForRedis) return;

    const redisKey = redisKeys.accessToken(integrationId);
    await redis.setex(redisKey, ttlSeconds, encryptedTokenForRedis);
}
