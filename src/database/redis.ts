import Redis from "ioredis";

import { env } from "@/lib/env";

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
    console.error("[Redis] Error:", err.message);
});

redis.on("connect", () => {
    console.log("[Redis] Connected");
});

export const redisKeys = {
    /** Grace period: old refresh token → { accessToken, refreshToken } */
    refreshGrace: (oldTokenHash: string) => `refresh:grace:${oldTokenHash}`,
} as const;