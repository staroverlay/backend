import crypto from "node:crypto";
import { and, desc, eq, count, inArray } from "drizzle-orm";
import { db } from "@/database";
import { env } from "@/lib/env";
import { BadRequestError, InternalServerError, NotFoundError } from "@/lib/errors";
import { widgets, widgetIntegrations, integrations as profileIntegrations, profiles } from "@/database/schema";
import { getUserPlan } from "@/services/subscription.service";
import { emitToWidget } from "@/events";
import { logger } from "@/logger";

// -----------------------------------------------------------------
// Interfaces & Types
// -----------------------------------------------------------------

export interface WidgetIntegrationRef {
    /** Composite public ID: provider:integrationId:providerUserId */
    id: string;
    integrationId: string;
    provider: string;
}

export interface WidgetResponse {
    id: string;
    app_id: string;
    display_name: string;
    enabled: boolean;
    integration_ids: WidgetIntegrationRef[];
    settings: Record<string, unknown>;
    token: string;
    created_at: Date;
    updated_at: Date;
}

type AppSettingsChild =
    | { id: string; type: "text"; default?: unknown }
    | { id: string; type: "number"; default?: unknown; num_type?: "integer" | string; num_min?: number; num_max?: number }
    | { id: string; type: "boolean"; default?: unknown }
    | { id: string; type: "select"; default?: unknown; options?: Array<{ value: string; label?: string }> }
    | { id: string; type: "color"; default?: unknown }
    | { id: string; type: "media:image" | "media:video" | "media:audio"; default?: unknown }
    | { id: string; type: "object" | "group"; fields?: AppSettingsChild[]; children?: AppSettingsChild[]; default?: unknown }
    | { id: string; type: "list"; item_type?: string; item_schema?: AppSettingsChild; default?: unknown }
    | { id: string; type: "map"; value_type?: string; value_schema?: AppSettingsChild; default?: unknown };

// -----------------------------------------------------------------
// Internal Helpers / State
// -----------------------------------------------------------------

/** Simple in-memory cache for app.json to avoid redundant HTTP requests (P-03) */
const APP_CONFIG_CACHE = new Map<string, { data: any; expiry: number }>();
const APP_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function generateWidgetToken(): string {
    return crypto.randomBytes(48).toString("hex");
}

function safeJsonParse<T>(raw: string | null): T {
    if (!raw) return {} as T;
    try {
        return JSON.parse(raw) as T;
    } catch {
        return {} as T;
    }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
    if (typeof v !== "object" || v === null) return false;
    const proto = Object.getPrototypeOf(v);
    return proto === Object.prototype || proto === null;
}

function deepMerge<T extends Record<string, unknown>, U extends Record<string, unknown>>(
    target: T,
    source: U,
    depth = 0
): T & U {
    if (depth > 10) return target as T & U;
    const out: Record<string, unknown> = { ...target };
    for (const [key, sourceVal] of Object.entries(source)) {
        const targetVal = (out as Record<string, unknown>)[key];
        if (isPlainObject(targetVal) && isPlainObject(sourceVal)) {
            (out as Record<string, unknown>)[key] = deepMerge(targetVal, sourceVal, depth + 1);
        } else {
            (out as Record<string, unknown>)[key] = sourceVal;
        }
    }
    return out as T & U;
}

function stripTrailingSlash(url: string): string {
    return url.endsWith("/") ? url.slice(0, -1) : url;
}

async function fetchAppJson(appId: string): Promise<any> {
    if (!/^[a-z0-9_-]+$/i.test(appId)) {
        throw new BadRequestError(`Invalid app_id format: "${appId}"`);
    }

    const cached = APP_CONFIG_CACHE.get(appId);
    if (cached && cached.expiry > Date.now()) return cached.data;

    const base = stripTrailingSlash(env.APP_WIDGET_SERVER);
    const url = `${base}/apps/${encodeURIComponent(appId)}/app.json`;

    try {
        const res = await fetch(url, { method: "GET" });
        if (!res.ok) {
            if (res.status === 404) throw new NotFoundError(`Unknown app_id "${appId}"`);
            throw new InternalServerError(`Failed to fetch app config (${res.status})`);
        }
        const data = await res.json();
        APP_CONFIG_CACHE.set(appId, { data, expiry: Date.now() + APP_CACHE_TTL });
        return data;
    } catch (e) {
        if (e instanceof NotFoundError) throw e;
        logger.error({ err: e, appId }, "Failed to fetch app.json");
        throw new NotFoundError(`App "${appId}" not reachable or config invalid`);
    }
}

function extractAppDisplayName(appJson: any, appId: string): string {
    const name = appJson?.name;
    if (typeof name === "string" && name.trim().length > 0) return name.trim();
    return appId;
}

function buildSettingsSpecsByKey(appJson: any): Map<string, AppSettingsChild> {
    const specs = new Map<string, AppSettingsChild>();
    const settingsDefs = Array.isArray(appJson?.settings) ? appJson.settings : [];

    const walk = (fields: any[], prefix = "") => {
        for (const f of fields) {
            const id = f?.id;
            const type = f?.type;
            if (typeof id !== "string" || typeof type !== "string") continue;
            const fullKey = prefix ? `${prefix}.${id}` : id;
            specs.set(fullKey, f as AppSettingsChild);
            if (type === "group") walk(f.children || f.fields || [], fullKey);
        }
    };
    walk(settingsDefs);
    return specs;
}

function validateAndBuildNestedSettings(
    input: Record<string, unknown>,
    specsByKey: Map<string, AppSettingsChild>
): Record<string, unknown> {
    const nested: Record<string, unknown> = {};

    const validateValue = (val: unknown, spec: AppSettingsChild, keyPath: string) => {
        if (val === null) return null;

        switch (spec.type) {
            case "text":
            case "color": {
                // FIXED S-07: text and color should be general strings, not file paths.
                if (typeof val !== "string") {
                    throw new BadRequestError(`Invalid type for "${keyPath}": expected string`);
                }
                break;
            }
            case "media:image":
            case "media:video":
            case "media:audio": {
                // Media fields MUST follow the usercontent format.
                if (typeof val !== "string") {
                    throw new BadRequestError(`Invalid type for "${keyPath}": expected string (path)`);
                }
                const parts = val.split("/");
                if (parts.length !== 3 || parts[0] !== "usercontent") {
                    throw new BadRequestError(`Invalid format for "${keyPath}": expected "usercontent/<profile-id>/<media-id>"`);
                }
                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
                if (!uuidRegex.test(parts[1]!) || !uuidRegex.test(parts[2]!)) {
                    throw new BadRequestError(`Invalid IDs for "${keyPath}": must be valid UUIDs`);
                }
                break;
            }
            case "number": {
                if (typeof val !== "number" || !Number.isFinite(val)) throw new BadRequestError(`Invalid type for "${keyPath}": expected number`);
                if (spec.num_type === "integer" && !Number.isInteger(val)) throw new BadRequestError(`Invalid value for "${keyPath}": expected integer`);
                if (typeof spec.num_min === "number" && (val as number) < spec.num_min) throw new BadRequestError(`Invalid value for "${keyPath}": must be >= ${spec.num_min}`);
                if (typeof spec.num_max === "number" && (val as number) > spec.num_max) throw new BadRequestError(`Invalid value for "${keyPath}": must be <= ${spec.num_max}`);
                break;
            }
            case "boolean": {
                if (typeof val !== "boolean") throw new BadRequestError(`Invalid type for "${keyPath}": expected boolean`);
                break;
            }
            case "select": {
                if (typeof val !== "string") throw new BadRequestError(`Invalid type for "${keyPath}": expected string`);
                const allowed = new Set((spec.options ?? []).map(o => o.value));
                if (allowed.size > 0 && !allowed.has(val as string)) throw new BadRequestError(`Invalid value for "${keyPath}": must be one of [${[...allowed].join(", ")}]`);
                break;
            }
            case "object":
            case "group": {
                if (!isPlainObject(val)) throw new BadRequestError(`Invalid type for "${keyPath}": expected object`);
                const fields = spec.fields || spec.children || [];
                const obj = val as Record<string, unknown>;
                for (const f of fields) {
                    if (obj[f.id] !== undefined) validateValue(obj[f.id], f, `${keyPath}.${f.id}`);
                }
                break;
            }
            case "list": {
                if (!Array.isArray(val)) throw new BadRequestError(`Invalid type for "${keyPath}": expected array`);
                if (spec.item_schema) val.forEach((item, i) => validateValue(item, spec.item_schema!, `${keyPath}[${i}]`));
                break;
            }
            case "map": {
                if (!isPlainObject(val)) throw new BadRequestError(`Invalid type for "${keyPath}": expected object`);
                if (spec.value_schema) {
                    const obj = val as Record<string, unknown>;
                    for (const k of Object.keys(obj)) validateValue(obj[k], spec.value_schema!, `${keyPath}.${k}`);
                }
                break;
            }
        }
        return val;
    };

    for (const key of Object.keys(input)) {
        const spec = specsByKey.get(key);
        if (!spec) throw new BadRequestError(`Unknown setting key "${key}"`);
        nested[key] = validateValue(input[key], spec, key);
    }
    return nested;
}

// -----------------------------------------------------------------
// Integration Resolution & Database Helpers
// -----------------------------------------------------------------

/**
 * FIXED Q-02: Extracted shared logic for resolving and validating integration IDs.
 */
async function resolveAndValidateIntegrations(
    profileId: string,
    integrationIds: string[],
    appJson: any
): Promise<string[]> {
    if (integrationIds.length === 0) {
        const integrationProps = Array.isArray(appJson?.properties?.integrations) ? appJson.properties.integrations : [];
        if (integrationProps.some((p: any) => p.is_required)) throw new BadRequestError("This app requires at least one integration");
        return [];
    }

    const allProfileIntegrations = await db
        .select()
        .from(profileIntegrations)
        .where(eq(profileIntegrations.profileId, profileId));

    const validMap = new Map();
    for (const i of allProfileIntegrations) {
        validMap.set(i.id, i.id);
        validMap.set(`${i.provider}:${i.id}:${i.providerUserId}`, i.id);
    }

    const resolved = integrationIds.map(id => {
        const realId = validMap.get(id);
        if (!realId) throw new BadRequestError(`Integration ID "${id}" is invalid or does not belong to you`);
        return realId;
    });

    const selectedRows = allProfileIntegrations.filter(i => resolved.includes(i.id));
    const connectedProviders = selectedRows.map(r => r.provider);
    const integrationProps = Array.isArray(appJson?.properties?.integrations) ? appJson.properties.integrations : [];

    const required = integrationProps.filter((p: any) => p.is_required).map((p: any) => p.provider);
    for (const r of required) {
        if (!connectedProviders.includes(r)) throw new BadRequestError(`Missing required integration: ${r}`);
    }

    const supported = integrationProps.map((p: any) => p.provider);
    for (const c of connectedProviders) {
        if (!supported.includes(c)) throw new BadRequestError(`App does not support integration provider: ${c}`);
    }

    return resolved;
}

/**
 * Helper to build public integration references.
 */
function buildIntegrationRefs(rows: any[]): WidgetIntegrationRef[] {
    return rows.map(r => ({
        id: `${r.provider}:${r.id}:${r.providerUserId}`,
        integrationId: r.id,
        provider: r.provider,
    }));
}

// -----------------------------------------------------------------
// Public Service Functions
// -----------------------------------------------------------------

export async function listUserWidgets(profileId: string): Promise<WidgetResponse[]> {
    // FIXED P-01: Use a single join query instead of N+1 queries.
    const rows = await db
        .select({
            widget: widgets,
            integration: profileIntegrations,
        })
        .from(widgets)
        .leftJoin(widgetIntegrations, eq(widgets.id, widgetIntegrations.widgetId))
        .leftJoin(profileIntegrations, eq(widgetIntegrations.integrationId, profileIntegrations.id))
        .where(eq(widgets.profileId, profileId))
        .orderBy(desc(widgets.createdAt));

    // Grouping results
    const widgetMap = new Map<string, WidgetResponse>();

    for (const row of rows) {
        const w = row.widget;
        if (!widgetMap.has(w.id)) {
            widgetMap.set(w.id, {
                id: w.id,
                app_id: w.appId,
                display_name: w.displayName,
                enabled: w.enabled,
                integration_ids: [],
                settings: safeJsonParse<Record<string, unknown>>(w.settings),
                token: w.token,
                created_at: w.createdAt,
                updated_at: w.updatedAt,
            });
        }

        if (row.integration) {
            const i = row.integration;
            widgetMap.get(w.id)!.integration_ids.push({
                id: `${i.provider}:${i.id}:${i.providerUserId}`,
                integrationId: i.id,
                provider: i.provider,
            });
        }
    }

    return Array.from(widgetMap.values());
}

export async function getWidget(profileId: string, id: string): Promise<WidgetResponse> {
    const rows = await db
        .select({
            widget: widgets,
            integration: profileIntegrations,
        })
        .from(widgets)
        .leftJoin(widgetIntegrations, eq(widgets.id, widgetIntegrations.widgetId))
        .leftJoin(profileIntegrations, eq(widgetIntegrations.integrationId, profileIntegrations.id))
        .where(and(eq(widgets.profileId, profileId), eq(widgets.id, id)));

    if (rows.length === 0) throw new NotFoundError("Widget not found");

    const w = rows[0]!.widget;
    const response: WidgetResponse = {
        id: w.id,
        app_id: w.appId,
        display_name: w.displayName,
        enabled: w.enabled,
        integration_ids: [],
        settings: safeJsonParse<Record<string, unknown>>(w.settings),
        token: w.token,
        created_at: w.createdAt,
        updated_at: w.updatedAt,
    };

    for (const row of rows) {
        if (row.integration) {
            const i = row.integration;
            response.integration_ids.push({
                id: `${i.provider}:${i.id}:${i.providerUserId}`,
                integrationId: i.id,
                provider: i.provider,
            });
        }
    }

    return response;
}

export async function createWidget(
    profileId: string,
    input: { app_id: string; integration_ids: string[]; display_name?: string }
): Promise<WidgetResponse> {
    // Plan limit check
    const [profileRow] = await db.select({ userId: profiles.userId }).from(profiles).where(eq(profiles.id, profileId)).limit(1);
    if (!profileRow) throw new NotFoundError("Profile not found");

    const plan = await getUserPlan(profileRow.userId);
    const [existingCount] = await db.select({ value: count(widgets.id) }).from(widgets).where(eq(widgets.profileId, profileId));
    const total = existingCount?.value ?? 0;
    if (total >= plan.limits.widgets) {
        throw new BadRequestError(`Widget limit reached (${plan.limits.widgets}). Please upgrade.`);
    }

    const appJson = await fetchAppJson(input.app_id);
    const displayName = extractAppDisplayName(appJson, input.app_id);

    // FIXED Q-02: Use helper
    const resolvedIds = await resolveAndValidateIntegrations(profileId, input.integration_ids ?? [], appJson);

    const token = generateWidgetToken();
    const now = new Date();

    // FIXED B-04: Wrap in transaction
    const result = await db.transaction(async (tx) => {
        const [widget] = await tx
            .insert(widgets)
            .values({
                profileId,
                appId: input.app_id,
                displayName: input.display_name || displayName,
                settings: "{}", // Default in DB
                enabled: true,
                token,
                createdAt: now,
                updatedAt: now,
            })
            .returning();

        if (!widget) throw new InternalServerError("Failed to create widget");

        if (resolvedIds.length > 0) {
            await tx.insert(widgetIntegrations).values(
                resolvedIds.map(integrationId => ({ widgetId: widget.id, integrationId }))
            );
        }

        return widget;
    });

    // FIXED P-04 / Q-08: Build response from memory instead of re-querying
    const allProfileIntegrations = await db.select().from(profileIntegrations).where(inArray(profileIntegrations.id, resolvedIds));

    return {
        id: result.id,
        app_id: result.appId,
        display_name: result.displayName,
        enabled: result.enabled,
        integration_ids: buildIntegrationRefs(allProfileIntegrations),
        settings: {},
        token: result.token,
        created_at: result.createdAt,
        updated_at: result.updatedAt,
    };
}

export async function updateWidgetMeta(
    profileId: string,
    widgetId: string,
    input: {
        display_name?: string;
        integration_ids?: string[];
        enabled?: boolean;
    }
): Promise<WidgetResponse> {
    const [existing] = await db.select().from(widgets).where(and(eq(widgets.profileId, profileId), eq(widgets.id, widgetId))).limit(1);
    if (!existing) throw new NotFoundError("Widget not found");

    const updates: Partial<typeof widgets.$inferInsert> = { updatedAt: new Date() };

    if (input.display_name !== undefined) {
        if (typeof input.display_name !== "string" || input.display_name.trim().length === 0) throw new BadRequestError("displayName must be non-empty");
        updates.displayName = input.display_name.trim();
    }

    if (input.enabled !== undefined) {
        if (typeof input.enabled !== "boolean") throw new BadRequestError("enabled must be boolean");
        updates.enabled = input.enabled;
    }

    let isIntegrationUpdate = false;
    let resolvedIds: string[] = [];

    if (input.integration_ids !== undefined) {
        const appJson = await fetchAppJson(existing.appId);
        resolvedIds = await resolveAndValidateIntegrations(profileId, input.integration_ids, appJson);
        isIntegrationUpdate = true;
    }

    const updatedWidget = await db.transaction(async (tx) => {
        const [updated] = await tx.update(widgets).set(updates).where(eq(widgets.id, widgetId)).returning();
        if (!updated) throw new InternalServerError("Failed to update widget");

        if (isIntegrationUpdate) {
            await tx.delete(widgetIntegrations).where(eq(widgetIntegrations.widgetId, widgetId));
            if (resolvedIds.length > 0) {
                await tx.insert(widgetIntegrations).values(resolvedIds.map(integrationId => ({ widgetId, integrationId })));
            }
        }
        return updated;
    });

    if (input.enabled !== undefined) {
        emitToWidget(updatedWidget.id, "widget:toggle", { enabled: updatedWidget.enabled });
    }

    // Refresh response
    return getWidget(profileId, widgetId);
}

export async function updateWidgetSettings(
    profileId: string,
    widgetId: string,
    dottedSettings: Record<string, unknown>
): Promise<WidgetResponse> {
    const [existing] = await db.select().from(widgets).where(and(eq(widgets.profileId, profileId), eq(widgets.id, widgetId))).limit(1);
    if (!existing) throw new NotFoundError("Widget not found");

    const appJson = await fetchAppJson(existing.appId);
    const specsByKey = buildSettingsSpecsByKey(appJson);

    if (!dottedSettings || typeof dottedSettings !== "object") throw new BadRequestError("settings must be an object");

    const nestedUpdate = validateAndBuildNestedSettings(dottedSettings, specsByKey);
    const existingParsed = safeJsonParse<Record<string, unknown>>(existing.settings);
    const merged = deepMerge(existingParsed, nestedUpdate);

    const [updated] = await db
        .update(widgets)
        .set({ settings: JSON.stringify(merged), updatedAt: new Date() })
        .where(eq(widgets.id, widgetId))
        .returning();

    if (!updated) throw new InternalServerError("Failed to update settings");

    emitToWidget(updated.id, "widget:settings_update", merged);

    return getWidget(profileId, widgetId);
}

export async function rotateWidgetToken(
    profileId: string,
    widgetId: string
): Promise<{ token: string }> {
    // FIXED Q-09: One-step verification + update
    const [updated] = await db
        .update(widgets)
        .set({ token: generateWidgetToken(), updatedAt: new Date() })
        .where(and(eq(widgets.profileId, profileId), eq(widgets.id, widgetId)))
        .returning({ token: widgets.token });

    if (!updated) throw new NotFoundError("Widget not found");
    return { token: updated.token };
}

export async function deleteWidget(profileId: string, widgetId: string): Promise<void> {
    // FIXED Q-09: One-step verification + delete
    const [deleted] = await db
        .delete(widgets)
        .where(and(eq(widgets.profileId, profileId), eq(widgets.id, widgetId)))
        .returning();

    if (!deleted) throw new NotFoundError("Widget not found");
}
