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
import { widgetsRoutes } from "./routes/widgets.routes";
import { uploadsRoutes } from "./routes/uploads.routes";
import { subscriptionRoutes } from "./routes/subscription.routes";
import { internalRoutes } from "./routes/internal.routes";
import { sdkRoutes } from "./routes/sdk.routes";
import { websocketPlugin, setAppInstance } from "./events";
import { logger } from "./logger";

await redis.connect();

const app = new Elysia();

// Global plugins & routes
app.use(wrap(logger, { useLevel: "trace" }));
app.use(
    cors({
        origin: [env.FRONTEND_URL, env.APP_WIDGET_SERVER],
        credentials: true,
        allowedHeaders: ["Content-Type", "Authorization"],
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    })
);

// Security Headers
app.onAfterHandle(({ set }) => {
    set.headers["X-Content-Type-Options"] = "nosniff";
    set.headers["X-Frame-Options"] = "DENY";
    set.headers["X-XSS-Protection"] = "1; mode=block";
    set.headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    set.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none';";
});
if (env.NODE_ENV !== "production") {
    app.use(
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
                    { name: "widgets", description: "Widget instances (per user)" },
                    { name: "oauth", description: "OAuth flows" },
                ],
            },
        })
    );
}

// Events (WebSocket)
app.use(websocketPlugin);

// Health check
app.get("/health", () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
    env: env.NODE_ENV,
}));

// Routes
app.use(oauthRoutes);
app.use(authRoutes);
app.use(profileRoutes);
app.use(integrationsRoutes);
app.use(sessionsRoutes);
app.use(widgetsRoutes);
app.use(uploadsRoutes);
app.use(subscriptionRoutes);
app.use(internalRoutes);
app.use(sdkRoutes);

// Global error handler
app.onError(({ code, error, path, set }) => {
    if (env.NODE_ENV !== "production") {
        logger.error(`[${code}] ${path}\n ${error}`);
    }

    if (code === "VALIDATION") {
        set.status = 422;
        const validationError = error as any;
        let message = "Validation error";

        if (validationError.all && validationError.all.length > 0) {
            const first = validationError.all[0];
            const path = (first.path as string).toLowerCase();

            if (path.includes("password")) {
                if (first.schema?.pattern) {
                    message = "Password must be at least 8 characters long and include an uppercase letter, a lowercase letter, and a number.";
                } else if (first.schema?.minLength) {
                    message = "Password must be at least 8 characters long.";
                } else {
                    message = first.message || first.summary || message;
                }
            } else {
                message = first.message || first.summary || message;
            }

            return {
                error: message,
                details: validationError.all,
            };
        }

        return {
            error: message,
            details: error.message,
        };
    }

    if (code === "NOT_FOUND") {
        set.status = 404;
        return { error: "Route not found" };
    }

    set.status = 500;
    return { error: "Internal server error" };
});

// Start server
app.listen(env.PORT, (_server) => {
    setAppInstance(app);
    logger.info(`Server running on "${env.NODE_ENV}" mode`);
    logger.info(`API running at http://localhost:${env.PORT}`);
    logger.info(`Swagger docs at http://localhost:${env.PORT}/swagger`);
});