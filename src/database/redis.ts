import Redis from "ioredis";

import { env } from "@/lib/env";
import { logger } from "@/logger";

export const redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    reconnectOnError: (err) => {
        const targetError = "READONLY";
        if (err.message.includes(targetError)) return true;
        return false;
    },
});

redis.on("error", (err) => {
    logger.error("Redis error: " + err.message);
});

redis.on("connect", () => {
    logger.info("Redis connected successfully");
});

export const redisKeys = {
    /** Cached encrypted access token for integration */
    accessToken: (integrationId: string) => `tokens:access:${integrationId}`,
    /** Grace period: old refresh token → { accessToken, refreshToken } */
    refreshGrace: (oldTokenHash: string) => `refresh:grace:${oldTokenHash}`,
    /** Email whitelist for beta registration */
    whitelist: (email: string) => `whitelist:${email.toLowerCase()}`,
} as const;