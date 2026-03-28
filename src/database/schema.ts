import {
    pgTable,
    uuid,
    text,
    boolean,
    timestamp,
    integer,
    pgEnum,
    unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const loginMethodEnum = pgEnum("login_method", [
    "email",
    "oauth_twitch",
    "oauth_kick",
    "oauth_youtube",
]);

export const integrationProviderEnum = pgEnum("integration_provider", [
    "twitch",
    "kick",
    "youtube",
]);

export const users = pgTable("users", {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash"), // nullable for pure oauth accounts
    emailVerified: boolean("email_verified").notNull().default(false),
    emailVerificationCode: text("email_verification_code"),
    emailVerificationExpiry: timestamp("email_verification_expiry"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const profiles = pgTable("profiles", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
        .notNull()
        .unique()
        .references(() => users.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    refreshTokenHash: text("refresh_token_hash").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    loginMethod: loginMethodEnum("login_method").notNull().default("email"),
    expiresAt: timestamp("expires_at").notNull(),
    revokedAt: timestamp("revoked_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const integrations = pgTable(
    "integrations",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        userId: uuid("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        provider: integrationProviderEnum("provider").notNull(),
        /** Optional custom display name set by the user */
        displayName: text("display_name"),
        /** Username on the external provider */
        providerUsername: text("provider_username").notNull(),
        /** User ID on the external provider */
        providerUserId: text("provider_user_id").notNull(),
        /** Avatar/icon URL from the provider */
        providerAvatarUrl: text("provider_avatar_url"),
        /** Encrypted access token for the provider */
        accessToken: text("access_token"),
        /** Encrypted refresh token for the provider */
        refreshToken: text("refresh_token"),
        tokenExpiresAt: timestamp("token_expires_at"),
        /** Whether this integration can be used to log into this account via OAuth */
        allowOauthLogin: boolean("allow_oauth_login").notNull().default(false),
        createdAt: timestamp("created_at").notNull().defaultNow(),
        updatedAt: timestamp("updated_at").notNull().defaultNow(),
    },
    (t) => ({
        uniqueUserProvider: unique().on(t.userId, t.provider),
    })
);

export const usersRelations = relations(users, ({ one, many }) => ({
    profile: one(profiles, { fields: [users.id], references: [profiles.userId] }),
    sessions: many(sessions),
    integrations: many(integrations),
}));

export const profilesRelations = relations(profiles, ({ one }) => ({
    user: one(users, { fields: [profiles.userId], references: [users.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
    user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const integrationsRelations = relations(integrations, ({ one }) => ({
    user: one(users, { fields: [integrations.userId], references: [users.id] }),
}));