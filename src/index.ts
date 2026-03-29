import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { wrap } from "@bogeychan/elysia-logger";

import { env } from "./lib/env";
import { redis } from "./database/redis";
import { authRoutes } from "./routes/auth.routes";
import { profileRoutes } from "./routes/profile.routes";
import { integrationsRoutes } from "./routes/integrations.routes";
import { oauthRoutes } from "./routes/oauth.routes";
import { sessionsRoutes } from "./routes/sessions.routes";
import { logger } from "./logger";

await redis.connect();

new Elysia()
    // Global plugins
    .use(wrap(logger, { useLevel: "debug" }))
    .use(
        cors({
            origin: env.FRONTEND_URL,
            credentials: true,
            allowedHeaders: ["Content-Type", "Authorization"],
            methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        })
    )
    .use(
        swagger({
            documentation: {
                info: {
                    title: "API",
                    version: "1.0.0",
                    description: "REST API with JWT auth, OAuth integrations",
                },
                tags: [
                    { name: "auth", description: "Authentication" },
                    { name: "profile", description: "User profile" },
                    { name: "sessions", description: "Session management" },
                    { name: "integrations", description: "Third-party integrations" },
                    { name: "oauth", description: "OAuth flows" },
                ],
            },
        })
    )

    // Health check
    .get("/health", () => ({
        status: "ok",
        timestamp: new Date().toISOString(),
        env: env.NODE_ENV,
    }))

    // Routes
    .use(oauthRoutes)
    .use(authRoutes)
    .use(profileRoutes)
    .use(integrationsRoutes)
    .use(sessionsRoutes)

    // Global error handler
    .onError(({ code, error, log: requestLog, path, set }) => {
        if (env.NODE_ENV !== "production") {
            requestLog!.error(`[${code}] ${path}\n ${error}`);
        }

        if (code === "VALIDATION") {
            set.status = 422;
            return {
                error: "Validation error",
                details: (error as any).all ?? error.message,
            };
        }

        if (code === "NOT_FOUND") {
            set.status = 404;
            return { error: "Route not found" };
        }

        set.status = 500;
        return { error: "Internal server error" };
    })

    .listen(env.PORT, () => {
        logger.info(`Server running on "${env.NODE_ENV}" mode`);
        logger.info(`API running at http://localhost:${env.PORT}`);
        logger.info(`Swagger docs at http://localhost:${env.PORT}/swagger`);
    });