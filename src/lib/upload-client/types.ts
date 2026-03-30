// ─── Token input types (what your backend passes in) ─────────────────────────

export interface CreateUploadTokenOptions {
    /** Unique file ID (UUID recommended) */
    fileId: string;
    /** Max allowed file size in bytes */
    maxBytes: number;
    /** Allowed MIME type */
    mimeType: string;
    /** Client's IP address (for binding) */
    clientIp: string;
    /** User ID of the owner */
    userId: string;
    /** Whether this is a thumbnail upload */
    thumbnail?: boolean;
    /** TTL in seconds (default: 3600, max: 3600) */
    ttl?: number;
}

export interface CreateAdminTokenOptions {
    purpose: "initiate" | "complete" | "abort" | "delete";
    fileId: string;
    userId: string;
    thumbnail?: boolean;
    mimeType?: string;
    clientIp?: string;
    /** For 'complete' */
    uploadId?: string;
    /** For 'complete' */
    parts?: Array<{ partNumber: number; etag: string }>;
    /** TTL in seconds (default: 300) */
    ttl?: number;
}

// ─── Worker API response types ────────────────────────────────────────────────

export interface InitiateResponse {
    uploadId: string;
    key: string;
    fileId: string;
}

export interface UploadPartResponse {
    partNumber: number;
    etag: string;
}

export interface CompleteResponse {
    fileId: string;
    key: string;
    path: string;
    size: number;
    etag: string;
    uploaded: string;
}

export interface AbortResponse {
    fileId: string;
    aborted: true;
}

export interface DeleteResponse {
    fileId: string;
    deleted: true;
}

// ─── Client config ────────────────────────────────────────────────────────────

export interface R2UploadClientConfig {
    /** Base URL of the Cloudflare worker, e.g. https://cdn.example.com */
    workerUrl: string;
    /** Shared secret used to sign user upload tokens (UPLOAD_JWT in worker) */
    jwtSecret: string;
    /** Backend-only secret for admin operations (UPLOAD_SECRET in worker) */
    backendSecret: string;
}

// ─── Multipart upload tracking ────────────────────────────────────────────────

export interface UploadedPart {
    partNumber: number;
    etag: string;
}

export interface MultipartSession {
    fileId: string;
    uploadId: string;
    key: string;
    uploadedParts: UploadedPart[];
}