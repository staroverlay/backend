import { eq, ne, and, sum, count } from "drizzle-orm";
import { db } from "@/database";
import { uploads } from "@/database/schema";
import { R2UploadClient } from "@/lib/upload-client/client";
import { env } from "@/lib/env";
import type { MultipartSession } from "@/lib/upload-client/types";

const MAX_BYTES = 50 * 1024 * 1024; // 50MB
const MAX_FILES = 25;

const uploadClient = new R2UploadClient({
    workerUrl: env.UPLOAD_SERVER,
    jwtSecret: env.UPLOAD_JWT,
    backendSecret: env.UPLOAD_SECRET,
});

export class UploadsService {
    /**
     * Get user quota information.
     */
    static async getQuota(userId: string) {
        const result = await db
            .select({
                usedBytes: sum(uploads.sizeBytes).mapWith(Number),
                usedCount: count(uploads.id),
            })
            .from(uploads)
            .where(
                and(
                    eq(uploads.userId, userId),
                    ne(uploads.status, "failed")
                )
            );

        const { usedBytes = 0, usedCount = 0 } = result[0] || {};

        return {
            usedBytes: usedBytes || 0,
            usedCount: usedCount || 0,
            maxBytes: MAX_BYTES,
            maxCount: MAX_FILES,
        };
    }

    /**
     * Initiates a new file upload.
     */
    static async initiateUpload(params: {
        userId: string;
        displayName: string;
        mimeType: string;
        sizeBytes: number;
        clientIp: string;
    }) {
        const { userId, displayName, mimeType, sizeBytes, clientIp } = params;

        let type: "image" | "video" | "audio";
        if (mimeType.startsWith("image/")) {
            type = "image";
        } else if (mimeType.startsWith("video/")) {
            type = "video";
        } else if (mimeType.startsWith("audio/")) {
            type = "audio";
        } else {
            throw new Error(`Unsupported file type: ${mimeType}. Only images, videos, and audio files are allowed.`);
        }

        const quota = await this.getQuota(userId);

        if (quota.usedCount >= quota.maxCount) {
            throw new Error(`Quota exceeded: maximum file count of ${quota.maxCount} reached.`);
        }

        if (quota.usedBytes + sizeBytes > quota.maxBytes) {
            throw new Error(`Quota exceeded: maximum file size of ${quota.maxBytes} bytes reached.`);
        }

        const [upload] = await db
            .insert(uploads)
            .values({
                userId,
                displayName,
                mimeType,
                sizeBytes,
                type,
                status: "pending",
            })
            .returning();

        if (!upload) throw new Error("Failed to create upload record");

        const uploadMetadata = await uploadClient.initiateUpload({
            fileId: upload.id,
            mimeType,
            clientIp,
            userId,
        });

        return { upload, ...uploadMetadata };
    }

    /**
     * Finalizes the upload by notifying the worker that all parts are sent.
     */
    static async completeUpload(userId: string, uploadId: string, session: MultipartSession) {
        // Verify upload belongs to user and is pending
        const [upload] = await db
            .select()
            .from(uploads)
            .where(and(eq(uploads.id, uploadId), eq(uploads.userId, userId), eq(uploads.status, "pending")));

        if (!upload) {
            throw new Error("Upload not found or not in pending state");
        }

        try {
            await uploadClient.completeUpload(session, userId, uploadId);

            const [completedUpload] = await db
                .update(uploads)
                .set({ status: "completed", updatedAt: new Date() })
                .where(eq(uploads.id, uploadId))
                .returning();

            return completedUpload;
        } catch (e) {
            await db
                .update(uploads)
                .set({ status: "failed", updatedAt: new Date() })
                .where(eq(uploads.id, uploadId));
            throw e;
        }
    }

    /**
     * Aborts an upload that has failed or is no longer needed.
     */
    static async abortUpload(userId: string, uploadId: string, r2UploadId: string) {
        const [upload] = await db
            .select()
            .from(uploads)
            .where(and(eq(uploads.id, uploadId), eq(uploads.userId, userId), eq(uploads.status, "pending")));

        if (!upload) return;

        try {
            await uploadClient.abortUpload(r2UploadId, userId, uploadId);
        } catch (e) {
            // Ignore error from worker if already aborted, just mark in db
        }

        await db
            .update(uploads)
            .set({ status: "failed", updatedAt: new Date() })
            .where(eq(uploads.id, uploadId));
    }

    /**
     * Deletes a fully completed or failed upload.
     */
    static async deleteUpload(userId: string, uploadId: string) {
        const [upload] = await db
            .select()
            .from(uploads)
            .where(and(eq(uploads.id, uploadId), eq(uploads.userId, userId)));

        if (!upload) {
            throw new Error("Upload not found");
        }

        // Call R2 worker delete
        await uploadClient.deleteFile(userId, uploadId).catch((err) => {
            // we continue deleting from DB even if not in worker maybe?
            console.error("Failed to delete upload from worker", err);
        });

        await db.delete(uploads).where(eq(uploads.id, uploadId));

        return true;
    }

    /**
     * List user uploads.
     */
    static async listUploads(userId: string) {
        const items = await db
            .select()
            .from(uploads)
            .where(and(eq(uploads.userId, userId), eq(uploads.status, "completed")))
            .orderBy(uploads.createdAt);

        return items.map((item) => ({
            ...item,
            url: uploadClient.fileUrl(userId, item.id),
            thumbnailUrl: uploadClient.thumbnailUrl(userId, item.id),
        }));
    }
}
