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
import { websocketPlugin, setAppInstance } from "./events";
import { logger } from "./logger";

await redis.connect();

const app = new Elysia();

// Global plugins & routes
app.use(wrap(logger, { useLevel: "debug" }));
app.use(
    cors({
        origin: [env.FRONTEND_URL, env.APP_WIDGET_SERVER, "http://localhost:5173", "http://localhost:4000"],
        credentials: true,
        allowedHeaders: ["Content-Type", "Authorization"],
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    })
);
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

// Global error handler
app.onError(({ code, error, path, set }) => {
    if (env.NODE_ENV !== "production") {
        logger.error(`[${code}] ${path}\n ${error}`);
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
});

// Start server
app.listen(env.PORT, (_server) => {
    setAppInstance(app);
    logger.info(`Server running on "${env.NODE_ENV}" mode`);
    logger.info(`API running at http://localhost:${env.PORT}`);
    logger.info(`Swagger docs at http://localhost:${env.PORT}/swagger`);
});