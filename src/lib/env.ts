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

    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().default(587),
    SMTP_SECURE: z.string().transform((v) => v === "true").default("false"),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    EMAIL_FROM: z.string().default("noreply@example.com"),

    FRONTEND_URL: z.string().default("http://localhost:5173"),
    APP_WIDGET_SERVER: z.string().default("http://localhost:4000"),

    TWITCH_CLIENT_ID: z.string().optional(),
    TWITCH_CLIENT_SECRET: z.string().optional(),
    TWITCH_REDIRECT_URI: z.string().optional(),

    KICK_CLIENT_ID: z.string().optional(),
    KICK_CLIENT_SECRET: z.string().optional(),
    KICK_REDIRECT_URI: z.string().optional(),

    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    GOOGLE_REDIRECT_URI: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    console.error("❌ Invalid environment variables:");
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
}

export const env = parsed.data;