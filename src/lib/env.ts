import { z } from "zod";

const envSchema = z.object({
    PORT: z.coerce.number().default(3000),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    REDIS_URL: z.string().min(1, "REDIS_URL is required"),

    JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 chars"),
    JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 chars"),
    JWT_ACCESS_EXPIRES_MIN: z.coerce.number().default(10),
    JWT_REFRESH_EXPIRES_DAYS: z.coerce.number().default(30),
    JWT_REFRESH_GRACE_MINUTES: z.coerce.number().default(3),

    RESEND_API_KEY: z.string().optional(),
    RESEND_MAIL_DOMAIN: z.string().optional(),

    FRONTEND_URL: z.string().default("http://localhost:5173"),
    APP_WIDGET_SERVER: z.string().default("http://localhost:4000"),
    INGEST_URL: z.string().default("http://localhost:7512"),

    TWITCH_CLIENT_ID: z.string().optional(),
    TWITCH_CLIENT_SECRET: z.string().optional(),
    TWITCH_REDIRECT_URI: z.string().optional(),
    TWITCH_EVENTSUB_SECRET: z.string().optional(),
    TWITCH_USE_LOCAL_MOCK: z.coerce.boolean().optional(),

    KICK_CLIENT_ID: z.string().optional(),
    KICK_CLIENT_SECRET: z.string().optional(),
    KICK_REDIRECT_URI: z.string().optional(),

    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    GOOGLE_REDIRECT_URI: z.string().optional(),

    OAUTH_ENCRYPTION_KEY: z.string().min(32, "OAUTH_ENCRYPTION_KEY must be at least 32 chars"),
    USE_TRUST_PROXY: z.string().transform((v) => v === "true" || v === "1").default("false"),

    UPLOAD_SERVER: z.string().min(1, "UPLOAD_SERVER is required"),
    UPLOAD_SECRET: z.string().min(1, "UPLOAD_SECRET is required"),
    UPLOAD_JWT: z.string().min(1, "UPLOAD_JWT is required"),
    FEATURE_EMAIL_WHITELIST: z.string().transform((v) => v === "true" || v === "1").default("false"),

    RABBITMQ_URL: z.string().default("amqp://localhost"),
    RABBITMQ_EXCHANGE: z.string().default("events"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    console.error("❌ Invalid environment variables:");
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
}

export const env = parsed.data;