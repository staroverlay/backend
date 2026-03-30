import type { CreateUploadTokenOptions, CreateAdminTokenOptions } from "./types";

const ALG = { name: "HMAC", hash: "SHA-256" } as const;
const MAX_TTL = 3600;

function base64url(data: ArrayBuffer | Uint8Array): string {
    const uint8 = data instanceof Uint8Array ? data : new Uint8Array(data);
    let bin = "";
    for (let i = 0; i < uint8.length; i++) {
        bin += String.fromCharCode(uint8[i]!);
    }
    const b64 = btoa(bin);
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function importKey(secret: string): Promise<CryptoKey> {
    const raw = new TextEncoder().encode(secret);
    return crypto.subtle.importKey("raw", raw, ALG, false, ["sign"]);
}

async function sign(payload: Record<string, unknown>, secret: string): Promise<string> {
    const encoder = new TextEncoder();
    const header = base64url(encoder.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
    const body = base64url(encoder.encode(JSON.stringify(payload)));
    const signingInput = `${header}.${body}`;

    const key = await importKey(secret);
    const sig = await crypto.subtle.sign(ALG.name, key, encoder.encode(signingInput));

    return `${signingInput}.${base64url(sig)}`;
}

export async function createUploadToken(
    opts: CreateUploadTokenOptions,
    secret: string
): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const ttl = Math.min(opts.ttl ?? MAX_TTL, MAX_TTL);

    return sign(
        {
            purpose: "upload",
            fileId: opts.fileId,
            maxBytes: opts.maxBytes,
            mimeType: opts.mimeType,
            clientIp: opts.clientIp,
            ownerType: "user",
            userId: opts.userId,
            thumbnail: opts.thumbnail ?? false,
            iat: now,
            exp: now + ttl,
        },
        secret
    );
}

export async function createAdminToken(
    opts: CreateAdminTokenOptions,
    secret: string
): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const ttl = Math.min(opts.ttl ?? 300, MAX_TTL);

    const payload: Record<string, unknown> = {
        purpose: opts.purpose,
        fileId: opts.fileId,
        ownerType: "user",
        userId: opts.userId,
        thumbnail: opts.thumbnail ?? false,
        iat: now,
        exp: now + ttl,
    };

    if (opts.purpose === "initiate") {
        payload.mimeType = opts.mimeType;
        payload.clientIp = opts.clientIp;
    }

    if (opts.purpose === "complete") {
        if (!opts.uploadId || !opts.parts?.length) {
            throw new Error("uploadId and parts are required for 'complete' token");
        }
        payload.uploadId = opts.uploadId;
        payload.parts = opts.parts;
    }

    if (opts.purpose === "abort") {
        if (!opts.uploadId) throw new Error("uploadId is required for 'abort' token");
        payload.uploadId = opts.uploadId;
    }

    return sign(payload, secret);
}