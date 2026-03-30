import crypto from "node:crypto";
import { and, desc, eq } from "drizzle-orm";

import { db } from "@/database";
import { env } from "@/lib/env";
import { BadRequestError, InternalServerError, NotFoundError } from "@/lib/errors";
import { widgets } from "@/database/schema";

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
    | {
        id: string;
        type: "text";
        default?: unknown;
    }
    | {
        id: string;
        type: "number";
        default?: unknown;
        num_type?: "integer" | string;
        num_min?: number;
        num_max?: number;
    }
    | {
        id: string;
        type: "boolean";
        default?: unknown;
    }
    | {
        id: string;
        type: "select";
        default?: unknown;
        options?: Array<{ value: string; label?: string }>;
    };

type AppSettingsGroup = {
    id: string;
    type: "group";
    children: AppSettingsChild[];
};

type AppSettingsDef = AppSettingsGroup | (AppSettingsChild & { type: AppSettingsChild["type"] });

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
    source: U
): T & U {
    const out: Record<string, unknown> = { ...target };
    for (const [key, sourceVal] of Object.entries(source)) {
        const targetVal = (out as Record<string, unknown>)[key];

        if (isPlainObject(targetVal) && isPlainObject(sourceVal)) {
            (out as Record<string, unknown>)[key] = deepMerge(
                targetVal as Record<string, unknown>,
                sourceVal as Record<string, unknown>
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
    const base = stripTrailingSlash(env.APP_WIDGET_SERVER);
    const url = `${base}/${encodeURIComponent(appId)}/app.json`;

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

    for (const def of settingsDefs) {
        const defType = def?.type;
        if (defType === "group") {
            const groupId = def?.id;
            const children = Array.isArray(def?.children) ? def.children : [];
            if (typeof groupId !== "string") continue;

            for (const child of children) {
                const childId = child?.id;
                const childType = child?.type;
                if (typeof childId !== "string" || typeof childType !== "string") continue;

                specs.set(`${groupId}.${childId}`, child as AppSettingsChild);
            }
        } else {
            const id = def?.id;
            const type = def?.type;
            if (typeof id === "string" && typeof type === "string") {
                specs.set(id, def as AppSettingsChild);
            }
        }
    }

    return specs;
}

function validateAndBuildNestedSettings(
    dottedInput: Record<string, unknown>,
    specsByKey: Map<string, AppSettingsChild>
): Record<string, unknown> {
    const nested: Record<string, unknown> = {};

    const keys = Object.keys(dottedInput);
    for (const key of keys) {
        const spec = specsByKey.get(key);
        if (!spec) {
            throw new BadRequestError(`Unknown setting key "${key}"`);
        }

        const value = dottedInput[key];
        switch (spec.type) {
            case "text": {
                if (typeof value !== "string") {
                    throw new BadRequestError(`Invalid type for "${key}": expected string`);
                }
                break;
            }

            case "number": {
                if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) {
                    throw new BadRequestError(`Invalid type for "${key}": expected number`);
                }

                if (spec.num_type === "integer") {
                    if (!Number.isInteger(value)) {
                        throw new BadRequestError(`Invalid value for "${key}": expected integer`);
                    }
                }

                if (typeof spec.num_min === "number" && value < spec.num_min) {
                    throw new BadRequestError(`Invalid value for "${key}": must be >= ${spec.num_min}`);
                }
                if (typeof spec.num_max === "number" && value > spec.num_max) {
                    throw new BadRequestError(`Invalid value for "${key}": must be <= ${spec.num_max}`);
                }
                break;
            }

            case "boolean": {
                if (typeof value !== "boolean") {
                    throw new BadRequestError(`Invalid type for "${key}": expected boolean`);
                }
                break;
            }

            case "select": {
                if (typeof value !== "string") {
                    throw new BadRequestError(`Invalid type for "${key}": expected string`);
                }
                const allowed = new Set((spec.options ?? []).map((o) => o.value));
                if (allowed.size === 0) {
                    throw new BadRequestError(`Invalid app settings schema: "${key}" has no options`);
                }
                if (!allowed.has(value)) {
                    throw new BadRequestError(`Invalid value for "${key}": must be one of [${[...allowed].join(", ")}]`);
                }
                break;
            }
        }

        // Build nested object from dot path.
        const parts = key.split(".");
        let cursor: Record<string, unknown> = nested;
        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i]!;
            const existing = cursor[part];
            if (!isPlainObject(existing)) cursor[part] = {};
            cursor = cursor[part] as Record<string, unknown>;
        }
        cursor[parts[parts.length - 1]!] = value;
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
    input: { app_id: string; integrations: string[] }
): Promise<WidgetResponse> {
    const appJson = await fetchAppJson(input.app_id);
    const display_name = extractAppDisplayName(appJson, input.app_id);

    const token = generateWidgetToken();
    const now = new Date();

    const integrations: WidgetIntegrations = input.integrations ?? [];
    if (!Array.isArray(integrations)) throw new BadRequestError("integrations must be an array");
    if (integrations.some((i) => typeof i !== "string" || i.trim().length === 0)) {
        throw new BadRequestError("integrations must be an array of non-empty strings");
    }

    const [widget] = await db
        .insert(widgets)
        .values({
            userId,
            appId: input.app_id,
            displayName: display_name,
            settings: "{}",
            integrations,
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
        if (input.integrations.some((i) => typeof i !== "string" || i.trim().length === 0)) {
            throw new BadRequestError("integrations must be an array of non-empty strings");
        }
        updates.integrations = input.integrations.map((s) => s.trim());
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

