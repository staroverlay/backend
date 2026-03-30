import { createUploadToken, createAdminToken } from "./jwt";
import type {
    R2UploadClientConfig,
    CreateUploadTokenOptions,
    CreateAdminTokenOptions,
    InitiateResponse,
    CompleteResponse,
    AbortResponse,
    DeleteResponse,
    MultipartSession,
    UploadedPart,
} from "./types";

export class R2UploadClient {
    private readonly workerUrl: string;
    private readonly jwtSecret: string;
    private readonly backendSecret: string;

    constructor(config: R2UploadClientConfig) {
        this.workerUrl = config.workerUrl.replace(/\/$/, "");
        this.jwtSecret = config.jwtSecret;
        this.backendSecret = config.backendSecret;
    }

    // ─── Token generation (for sending to clients) ──────────────────────────

    /**
     * Creates a signed JWT the client will use to upload a file.
     * Your backend should:
     *  1. Validate the user has quota.
     *  2. Deduct the quota.
     *  3. Call this and send the token + fileId to the client.
     */
    async createUploadToken(opts: CreateUploadTokenOptions): Promise<string> {
        return createUploadToken(opts, this.jwtSecret);
    }

    /**
     * Creates a signed JWT for a thumbnail upload.
     * Same flow as a regular upload token but with thumbnail: true.
     */
    async createThumbnailToken(opts: Omit<CreateUploadTokenOptions, "thumbnail">): Promise<string> {
        return createUploadToken({ ...opts, thumbnail: true }, this.jwtSecret);
    }

    // ─── Admin operations (backend → worker, never exposed to clients) ───────

    /**
     * Initiates a multipart upload securely.
     */
    async initiateUpload(
        options: { fileId: string; userId: string; mimeType: string; clientIp: string; thumbnail?: boolean }
    ): Promise<InitiateResponse> {
        const token = await createAdminToken(
            {
                purpose: "initiate",
                fileId: options.fileId,
                userId: options.userId,
                mimeType: options.mimeType,
                clientIp: options.clientIp,
                thumbnail: options.thumbnail,
                ttl: 60,
            },
            this.backendSecret
        );
        return this.adminRequest<InitiateResponse>("POST", "/admin/initiate", token);
    }

    /**
     * Finalizes a multipart upload on behalf of the backend.
     * Call this after the client notifies you that all parts are uploaded.
     *
     * @param session  The multipart session received from the client.
     * @param userId   The user who owns the file.
     * @param fileId   The file ID being completed.
     */
    async completeUpload(
        session: Pick<MultipartSession, "uploadId" | "uploadedParts">,
        userId: string,
        fileId: string,
        thumbnail = false
    ): Promise<CompleteResponse> {
        const token = await createAdminToken(
            {
                purpose: "complete",
                fileId,
                userId,
                thumbnail,
                uploadId: session.uploadId,
                parts: session.uploadedParts,
                ttl: 300,
            },
            this.backendSecret
        );

        return this.adminRequest<CompleteResponse>("POST", "/admin/complete", token);
    }

    /**
     * Aborts an in-progress multipart upload, freeing all uploaded parts.
     */
    async abortUpload(
        uploadId: string,
        userId: string,
        fileId: string,
        thumbnail = false
    ): Promise<AbortResponse> {
        const token = await createAdminToken(
            { purpose: "abort", fileId, userId, uploadId, thumbnail, ttl: 300 },
            this.backendSecret
        );

        return this.adminRequest<AbortResponse>("POST", "/admin/abort", token);
    }

    /**
     * Permanently deletes a file (and its thumbnail if it exists) from R2.
     */
    async deleteFile(userId: string, fileId: string): Promise<DeleteResponse> {
        const token = await createAdminToken(
            { purpose: "delete", fileId, userId, ttl: 300 },
            this.backendSecret
        );

        return this.adminRequest<DeleteResponse>("DELETE", "/admin/delete", token);
    }

    // ─── URL helpers ─────────────────────────────────────────────────────────

    /** Returns the public URL for a user's file. */
    fileUrl(userId: string, fileId: string): string {
        return `${this.workerUrl}/usercontent/${userId}/${fileId}`;
    }

    /** Returns the public URL for a file's thumbnail. */
    thumbnailUrl(userId: string, fileId: string): string {
        return `${this.workerUrl}/usercontent/${userId}/${fileId}/thumbnail`;
    }

    // ─── Private ─────────────────────────────────────────────────────────────

    private async adminRequest<T>(method: string, path: string, token: string): Promise<T> {
        const res = await fetch(`${this.workerUrl}${path}`, {
            method,
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
        });

        const body = await res.json() as Record<string, unknown>;

        if (!res.ok) {
            const err = (body.error as Record<string, string>) ?? {};
            throw new WorkerApiError(
                err.code ?? "unknown_error",
                err.message ?? `Worker returned ${res.status}`,
                res.status
            );
        }

        return body as T;
    }
}

export class WorkerApiError extends Error {
    constructor(
        public readonly code: string,
        message: string,
        public readonly statusCode: number
    ) {
        super(message);
        this.name = "WorkerApiError";
    }
}