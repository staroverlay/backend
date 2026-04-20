import {
    pgTable,
    uuid,
    text,
    boolean,
    timestamp,
    integer,
    pgEnum,
    unique,
    index,
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
        profileId: uuid("profile_id")
            .notNull()
            .references(() => profiles.id, { onDelete: "cascade" }),
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
        isActive: boolean("is_active").notNull().default(true),
        lastUsedAt: timestamp("last_used_at"),
        createdAt: timestamp("created_at").notNull().defaultNow(),
        updatedAt: timestamp("updated_at").notNull().defaultNow(),
    },
    (t) => ({
        uniqueProfileProvider: unique().on(t.profileId, t.provider, t.providerUserId),
    })
);

// NOTE: `usersRelations` se declara más abajo, una vez definida la tabla `widgets`.

// NOTE: profiles full relations are declared below after all domain tables are defined.

export const sessionsRelations = relations(sessions, ({ one }) => ({
    user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const integrationsRelations = relations(integrations, ({ one }) => ({
    profile: one(profiles, { fields: [integrations.profileId], references: [profiles.id] }),
}));

export const widgets = pgTable("widgets", {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
        .notNull()
        .references(() => profiles.id, { onDelete: "cascade" }),

    /** Widget instance is based on the app id provided by the user */
    appId: text("app_id").notNull(),
    displayName: text("display_name").notNull(),

    /** JSON string with widget settings */
    settings: text("settings").notNull().default("{}"),

    enabled: boolean("enabled").notNull().default(true),

    /** Long random token; can be rotated */
    token: text("token").notNull().unique(),

    tokenExpiresAt: timestamp("token_expires_at"),
    tokenRevokedAt: timestamp("token_revoked_at"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const widgetIntegrations = pgTable("widget_integrations", {
    widgetId: uuid("widget_id")
        .notNull()
        .references(() => widgets.id, { onDelete: "cascade" }),

    integrationId: uuid("integration_id")
        .notNull()
        .references(() => integrations.id, { onDelete: "cascade" }),
});

export const widgetsRelations = relations(widgets, ({ one, many }) => ({
    profile: one(profiles, { fields: [widgets.profileId], references: [profiles.id] }),
    integrations: many(widgetIntegrations),
}));

export const widgetIntegrationsRelations = relations(widgetIntegrations, ({ one }) => ({
    widget: one(widgets, { fields: [widgetIntegrations.widgetId], references: [widgets.id] }),
    integration: one(integrations, { fields: [widgetIntegrations.integrationId], references: [integrations.id] }),
}));

// Re-export con widgets relation incluida (se mantiene separado por el orden
// de declaraciones dentro de este módulo).
export const usersRelations = relations(users, ({ one, many }) => ({
    profile: one(profiles, { fields: [users.id], references: [profiles.userId] }),
    sessions: many(sessions),
    subscription: one(subscriptions, { fields: [users.id], references: [subscriptions.userId] }),
}));

export const profilesRelations = relations(profiles, ({ one, many }) => ({
    user: one(users, { fields: [profiles.userId], references: [users.id] }),
    integrations: many(integrations),
    widgets: many(widgets),
    uploads: many(uploads),
    events: many(events),
}));

export const uploadStatusEnum = pgEnum("upload_status", [
    "pending",
    "completed",
    "failed"
]);

export const uploadTypeEnum = pgEnum("upload_type", [
    "image",
    "video",
    "audio"
]);

export const uploads = pgTable("uploads", {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
        .notNull()
        .references(() => profiles.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull().default(0),
    type: uploadTypeEnum("type").notNull(),
    status: uploadStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const uploadsRelations = relations(uploads, ({ one }) => ({
    profile: one(profiles, { fields: [uploads.profileId], references: [profiles.id] }),
}));

export const subscriptions = pgTable("subscriptions", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
        .notNull()
        .unique()
        .references(() => users.id, { onDelete: "cascade" }),
    planId: text("plan_id").notNull(),
    expiresAt: timestamp("expires_at"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
    user: one(users, { fields: [subscriptions.userId], references: [users.id] }),
}));

export const events = pgTable(
    "events",
    {
        id: text("id").primaryKey(), // event_id from ingest

        profileId: uuid("profile_id")
            .notNull()
            .references(() => profiles.id, { onDelete: "cascade" }),

        integrationId: uuid("integration_id"),

        provider: integrationProviderEnum("provider").notNull(),
        type: text("type").notNull(),

        normalizedPayload: text("normalized_payload").notNull(),
        rawPayload: text("raw_payload").notNull(),

        occurredAt: timestamp("occurred_at").notNull(),
        createdAt: timestamp("created_at").notNull().defaultNow(),
    },
    (t) => ({
        eventsProfileCreatedIdx: index("events_profile_created_idx").on(t.profileId, t.createdAt),
        eventsProfileTypeIdx: index("events_profile_type_idx").on(t.profileId, t.type),
    })
);

export const eventsRelations = relations(events, ({ one }) => ({
    profile: one(profiles, { fields: [events.profileId], references: [profiles.id] }),
    integration: one(integrations, { fields: [events.integrationId], references: [integrations.id] }),
}));