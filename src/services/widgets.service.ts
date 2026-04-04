import crypto from "node:crypto";
import { and, desc, eq, inArray, count } from "drizzle-orm";
import { db } from "@/database";
import { env } from "@/lib/env";
import { BadRequestError, InternalServerError, NotFoundError } from "@/lib/errors";
import { widgets, integrations as userIntegrations } from "@/database/schema";
import { getUserPlan } from "@/services/subscription.service";
import { emitToWidget } from "@/events";

type WidgetIntegrations = string[];

export interface WidgetResponse {
    id: string;
    app_id: string;
    display_name: string;
    enabled: boolean;
    integrations: WidgetIntegrations;
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

type AppSettingsDef = { id: string; type: "group"; children: AppSettingsChild[] } | AppSettingsChild;

function generateWidgetToken(): string {
    // 96 hex chars (48 bytes) approx.
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
    if (depth > 10) return target as T & U; // prevent stack overflow

    const out: Record<string, unknown> = { ...target };
    for (const [key, sourceVal] of Object.entries(source)) {
        const targetVal = (out as Record<string, unknown>)[key];

        if (isPlainObject(targetVal) && isPlainObject(sourceVal)) {
            (out as Record<string, unknown>)[key] = deepMerge(
                targetVal as Record<string, unknown>,
                sourceVal as Record<string, unknown>,
                depth + 1
            );
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
    const base = stripTrailingSlash(env.APP_WIDGET_SERVER);
    const url = `${base}/${encodeURIComponent(appId)}/meta/app.json`;

    let res: Response;
    try {
        res = await fetch(url, { method: "GET" });
    } catch {
        throw new NotFoundError(`App "${appId}" not reachable`);
    }

    if (!res.ok) {
        if (res.status === 404) throw new NotFoundError(`Unknown app_id "${appId}"`);
        throw new InternalServerError(`Failed to fetch app config (${res.status})`);
    }

    return res.json();
}

function extractAppDisplayName(appJson: any, appId: string): string {
    const name = appJson?.name;
    if (typeof name === "string" && name.trim().length > 0) return name.trim();
    // Fallback: not ideal, but better than crashing.
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

            if (type === "group") {
                walk(f.children || f.fields || [], fullKey);
            }
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
            case "color":
            case "media:image":
            case "media:video":
            case "media:audio": {
                if (typeof val !== "string") {
                    throw new BadRequestError(`Invalid type for "${keyPath}": expected string (path)`);
                }
                const parts = val.split("/");
                // Valid format: usercontent/<user-id>/<media-id>
                if (parts.length !== 3 || parts[0] !== "usercontent") {
                    throw new BadRequestError(`Invalid format for "${keyPath}": expected "usercontent/<user-id>/<media-id>"`);
                }
                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
                if (!uuidRegex.test(parts[1]!) || !uuidRegex.test(parts[2]!)) {
                    throw new BadRequestError(`Invalid IDs for "${keyPath}": must be valid UUIDs`);
                }
                break;
            }
            case "number": {
                if (typeof val !== "number" || !Number.isFinite(val)) {
                    throw new BadRequestError(`Invalid type for "${keyPath}": expected number`);
                }
                if (spec.num_type === "integer" && !Number.isInteger(val)) {
                    throw new BadRequestError(`Invalid value for "${keyPath}": expected integer`);
                }
                if (typeof spec.num_min === "number" && (val as number) < spec.num_min) {
                    throw new BadRequestError(`Invalid value for "${keyPath}": must be >= ${spec.num_min}`);
                }
                if (typeof spec.num_max === "number" && (val as number) > spec.num_max) {
                    throw new BadRequestError(`Invalid value for "${keyPath}": must be <= ${spec.num_max}`);
                }
                break;
            }
            case "boolean": {
                if (typeof val !== "boolean") {
                    throw new BadRequestError(`Invalid type for "${keyPath}": expected boolean`);
                }
                break;
            }
            case "select": {
                if (typeof val !== "string") {
                    throw new BadRequestError(`Invalid type for "${keyPath}": expected string`);
                }
                const allowed = new Set((spec.options ?? []).map(o => o.value));
                if (allowed.size > 0 && !allowed.has(val as string)) {
                    throw new BadRequestError(`Invalid value for "${keyPath}": must be one of [${[...allowed].join(", ")}]`);
                }
                break;
            }
            case "object":
            case "group": {
                if (!isPlainObject(val)) {
                    throw new BadRequestError(`Invalid type for "${keyPath}": expected object`);
                }
                const fields = spec.fields || spec.children || [];
                const obj = val as Record<string, unknown>;
                for (const f of fields) {
                    if (obj[f.id] !== undefined) {
                        validateValue(obj[f.id], f, `${keyPath}.${f.id}`);
                    }
                }
                break;
            }
            case "list": {
                if (!Array.isArray(val)) {
                    throw new BadRequestError(`Invalid type for "${keyPath}": expected array`);
                }
                if (spec.item_schema) {
                    val.forEach((item, i) => validateValue(item, spec.item_schema!, `${keyPath}[${i}]`));
                }
                break;
            }
            case "map": {
                if (!isPlainObject(val)) {
                    throw new BadRequestError(`Invalid type for "${keyPath}": expected object`);
                }
                if (spec.value_schema) {
                    const obj = val as Record<string, unknown>;
                    for (const k of Object.keys(obj)) {
                        validateValue(obj[k], spec.value_schema!, `${keyPath}.${k}`);
                    }
                }
                break;
            }
        }
        return val;
    };

    // We expect the input to be hierarchical now from the UI
    for (const key of Object.keys(input)) {
        const spec = specsByKey.get(key);
        if (!spec) {
            throw new BadRequestError(`Unknown setting key "${key}"`);
        }
        nested[key] = validateValue(input[key], spec, key);
    }

    return nested;
}

export async function listUserWidgets(userId: string): Promise<WidgetResponse[]> {
    const rows = await db
        .select()
        .from(widgets)
        .where(eq(widgets.userId, userId))
        .orderBy(desc(widgets.createdAt));

    return rows.map((w) => ({
        id: w.id,
        app_id: w.appId,
        display_name: w.displayName,
        enabled: w.enabled,
        integrations: w.integrations as unknown as string[],
        settings: safeJsonParse<Record<string, unknown>>(w.settings),
        token: w.token,
        created_at: w.createdAt,
        updated_at: w.updatedAt,
    }));
}

export async function getWidget(userId: string, id: string): Promise<WidgetResponse> {
    const [w] = await db
        .select()
        .from(widgets)
        .where(and(eq(widgets.userId, userId), eq(widgets.id, id)))
        .limit(1);

    if (!w) throw new NotFoundError("Widget not found");

    return {
        id: w.id,
        app_id: w.appId,
        display_name: w.displayName,
        enabled: w.enabled,
        integrations: w.integrations as unknown as string[],
        settings: safeJsonParse<Record<string, unknown>>(w.settings),
        token: w.token,
        created_at: w.createdAt,
        updated_at: w.updatedAt,
    };
}

export async function createWidget(
    userId: string,
    input: { app_id: string; integrations: string[]; display_name?: string }
): Promise<WidgetResponse> {
    const plan = await getUserPlan(userId);

    const [existingCount] = await db
        .select({ value: count(widgets.id) })
        .from(widgets)
        .where(eq(widgets.userId, userId));

    const total = existingCount?.value ?? 0;
    if (total >= plan.limits.widgets) {
        throw new BadRequestError(`Widget limit reached for your plan (${plan.limits.widgets}). Please upgrade to create more widgets.`);
    }

    const appJson = await fetchAppJson(input.app_id);
    const display_line_name = extractAppDisplayName(appJson, input.app_id);

    const token = generateWidgetToken();
    const now = new Date();

    const integrationIds = input.integrations ?? [];
    if (!Array.isArray(integrationIds)) throw new BadRequestError("integrations must be an array");

    // Validate integrations belong to user and match app requirements
    if (integrationIds.length > 0) {
        const userRows = await db
            .select()
            .from(userIntegrations)
            .where(
                and(
                    eq(userIntegrations.userId, userId),
                    inArray(userIntegrations.id, integrationIds)
                )
            );

        if (userRows.length !== integrationIds.length) {
            throw new BadRequestError("One or more integration IDs are invalid or do not belong to you");
        }

        // Check if required providers are present
        const integrationProps = Array.isArray(appJson?.properties?.integrations)
            ? appJson.properties.integrations
            : [];
        const requiredProviders = integrationProps
            .filter((p: any) => p.is_required)
            .map((p: any) => p.provider);

        const connectedProviders = userRows.map(r => r.provider);
        for (const req of requiredProviders) {
            if (!connectedProviders.includes(req)) {
                throw new BadRequestError(`Missing required integration: ${req}`);
            }
        }

        // Ensure providers match what the app supports
        const supportedProviders = integrationProps.map((p: any) => p.provider);
        for (const conn of connectedProviders) {
            if (!supportedProviders.includes(conn)) {
                throw new BadRequestError(`App does not support integration provider: ${conn}`);
            }
        }
    } else {
        // If no integrations provided, check if any are required
        const integrationProps = Array.isArray(appJson?.properties?.integrations)
            ? appJson.properties.integrations
            : [];
        const hasRequired = integrationProps.some((p: any) => p.is_required);
        if (hasRequired) {
            throw new BadRequestError("This app requires at least one integration");
        }
    }

    const [widget] = await db
        .insert(widgets)
        .values({
            userId,
            appId: input.app_id,
            displayName: input.display_name || display_line_name,
            settings: "{}",
            integrations: integrationIds,
            enabled: true,
            token,
            createdAt: now,
            updatedAt: now,
        })
        .returning();

    if (!widget) throw new InternalServerError("Failed to create widget");

    return {
        id: widget.id,
        app_id: widget.appId,
        display_name: widget.displayName,
        enabled: widget.enabled,
        integrations: widget.integrations as unknown as string[],
        settings: {},
        token: widget.token,
        created_at: widget.createdAt,
        updated_at: widget.updatedAt,
    };
}

export async function updateWidgetMeta(
    userId: string,
    widgetId: string,
    input: {
        display_name?: string;
        integrations?: string[];
        enabled?: boolean;
    }
): Promise<WidgetResponse> {
    const [existing] = await db
        .select()
        .from(widgets)
        .where(and(eq(widgets.userId, userId), eq(widgets.id, widgetId)))
        .limit(1);

    if (!existing) throw new NotFoundError("Widget not found");

    const updates: Partial<typeof widgets.$inferInsert> = {
        updatedAt: new Date(),
    };

    if (input.display_name !== undefined) {
        if (typeof input.display_name !== "string" || input.display_name.trim().length === 0) {
            throw new BadRequestError("displayName must be a non-empty string");
        }
        updates.displayName = input.display_name.trim();
    }

    if (input.integrations !== undefined) {
        if (!Array.isArray(input.integrations)) throw new BadRequestError("integrations must be an array");
        const integrationIds = input.integrations;

        if (integrationIds.length > 0) {
            const userRows = await db
                .select()
                .from(userIntegrations)
                .where(
                    and(
                        eq(userIntegrations.userId, userId),
                        inArray(userIntegrations.id, integrationIds)
                    )
                );

            if (userRows.length !== integrationIds.length) {
                throw new BadRequestError("One or more integration IDs are invalid or do not belong to you");
            }

            // Check against app requirements
            const appJson = await fetchAppJson(existing.appId);
            const integrationProps = Array.isArray(appJson?.properties?.integrations)
                ? appJson.properties.integrations
                : [];
            const requiredProviders = integrationProps
                .filter((p: any) => p.is_required)
                .map((p: any) => p.provider);

            const connectedProviders = userRows.map(r => r.provider);
            for (const req of requiredProviders) {
                if (!connectedProviders.includes(req)) {
                    throw new BadRequestError(`Missing required integration: ${req}`);
                }
            }

            // Ensure providers match what the app supports
            const supportedProviders = integrationProps.map((p: any) => p.provider);
            for (const conn of connectedProviders) {
                if (!supportedProviders.includes(conn)) {
                    throw new BadRequestError(`App does not support integration provider: ${conn}`);
                }
            }
        } else {
            const appJson = await fetchAppJson(existing.appId);
            const integrationProps = Array.isArray(appJson?.properties?.integrations)
                ? appJson.properties.integrations
                : [];
            const hasRequired = integrationProps.some((p: any) => p.is_required);
            if (hasRequired) {
                throw new BadRequestError("This app requires at least one integration");
            }
        }

        updates.integrations = integrationIds;
    }

    if (input.enabled !== undefined) {
        if (typeof input.enabled !== "boolean") throw new BadRequestError("enabled must be boolean");
        updates.enabled = input.enabled;
    }

    const [updated] = await db
        .update(widgets)
        .set(updates)
        .where(eq(widgets.id, existing.id))
        .returning();

    if (!updated) throw new InternalServerError("Failed to update widget");

    // Emit real-time toggle event if enabled status changed
    if (input.enabled !== undefined) {
        emitToWidget(updated.id, "widget:toggle", { enabled: updated.enabled });
    }

    return {
        id: updated.id,
        app_id: updated.appId,
        display_name: updated.displayName,
        enabled: updated.enabled,
        integrations: updated.integrations as unknown as string[],
        settings: safeJsonParse<Record<string, unknown>>(updated.settings),
        token: updated.token,
        created_at: updated.createdAt,
        updated_at: updated.updatedAt,
    };
}

export async function updateWidgetSettings(
    userId: string,
    widgetId: string,
    dottedSettings: Record<string, unknown>
): Promise<WidgetResponse> {
    const [existing] = await db
        .select()
        .from(widgets)
        .where(and(eq(widgets.userId, userId), eq(widgets.id, widgetId)))
        .limit(1);

    if (!existing) throw new NotFoundError("Widget not found");

    const appJson = await fetchAppJson(existing.appId);
    const specsByKey = buildSettingsSpecsByKey(appJson);

    if (!dottedSettings || typeof dottedSettings !== "object") {
        throw new BadRequestError("settings must be an object");
    }

    const nestedUpdate = validateAndBuildNestedSettings(dottedSettings, specsByKey);
    const existingParsed = safeJsonParse<Record<string, unknown>>(existing.settings);
    const merged = deepMerge(existingParsed, nestedUpdate);

    const [updated] = await db
        .update(widgets)
        .set({
            settings: JSON.stringify(merged),
            updatedAt: new Date(),
        })
        .where(eq(widgets.id, existing.id))
        .returning();

    if (!updated) throw new InternalServerError("Failed to update widget settings");

    // Emit real-time settings update
    emitToWidget(updated.id, "widget:settings_update", merged);

    return {
        id: updated.id,
        app_id: updated.appId,
        display_name: updated.displayName,
        enabled: updated.enabled,
        integrations: updated.integrations as unknown as string[],
        settings: safeJsonParse<Record<string, unknown>>(updated.settings),
        token: updated.token,
        created_at: updated.createdAt,
        updated_at: updated.updatedAt,
    };
}

export async function rotateWidgetToken(
    userId: string,
    widgetId: string
): Promise<{ token: string }> {
    const [existing] = await db
        .select()
        .from(widgets)
        .where(and(eq(widgets.userId, userId), eq(widgets.id, widgetId)))
        .limit(1);

    if (!existing) throw new NotFoundError("Widget not found");

    const token = generateWidgetToken();

    const [updated] = await db
        .update(widgets)
        .set({
            token,
            updatedAt: new Date(),
        })
        .where(eq(widgets.id, existing.id))
        .returning({ token: widgets.token });

    if (!updated) throw new InternalServerError("Failed to rotate widget token");
    return { token: updated.token };
}

export async function deleteWidget(userId: string, widgetId: string): Promise<void> {
    const [existing] = await db
        .select()
        .from(widgets)
        .where(and(eq(widgets.userId, userId), eq(widgets.id, widgetId)))
        .limit(1);

    if (!existing) throw new NotFoundError("Widget not found");

    const [deleted] = await db
        .delete(widgets)
        .where(eq(widgets.id, existing.id))
        .returning();

    if (!deleted) throw new InternalServerError("Failed to delete widget");
}

