import { redis } from "@/database/redis";
import { getClientMeta } from "@/lib/request-helpers";
import { logger } from "@/logger";

interface RateLimitOptions {
    limit: number;
    duration: number; // in seconds
}

export const rateLimit = (opts: RateLimitOptions) =>
    async ({ request, set }: { request: Request; set: { status?: number | string | any } }) => {
        const { ipAddress } = getClientMeta(request);

        const identifier = ipAddress || "unknown_ip";
        const url = new URL(request.url);
        const key = `ratelimit:${identifier}:${request.method}:${url.pathname}`;

        try {
            const count = await redis.incr(key);

            if (count === 1) {
                await redis.expire(key, opts.duration);
            }

            if (count > opts.limit) {
                set.status = 429;
                return {
                    error: "Too many requests. Please slow down.",
                    retryAfter: opts.duration
                };
            }
        } catch (err) {
            logger.error("Rate limit check failed: " + err);
        }
    };
