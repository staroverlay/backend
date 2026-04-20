import { eq, ne, and, sum, count } from "drizzle-orm";
import { db } from "@/database";
import { uploads, profiles } from "@/database/schema";
import { R2UploadClient } from "@/lib/upload-client/client";
import { getUserPlan } from "@/services/subscription.service";
import { env } from "@/lib/env";
import type { MultipartSession } from "@/lib/upload-client/types";

const uploadClient = new R2UploadClient({
    workerUrl: env.UPLOAD_SERVER,
    jwtSecret: env.UPLOAD_JWT,
    backendSecret: env.UPLOAD_SECRET,
});

export class UploadsService {
    /**
     * Get profile quota information.
     */
    static async getQuota(profileId: string) {
        // Subscription limits are still user-scoped; resolve userId via profile
        const [profileRow] = await db
            .select({ userId: profiles.userId })
            .from(profiles)
            .where(eq(profiles.id, profileId))
            .limit(1);

        if (!profileRow) throw new Error("Profile not found");

        const plan = await getUserPlan(profileRow.userId);
        const result = await db
            .select({
                usedBytes: sum(uploads.sizeBytes).mapWith(Number),
                usedCount: count(uploads.id),
            })
            .from(uploads)
            .where(
                and(
                    eq(uploads.profileId, profileId),
                    ne(uploads.status, "failed")
                )
            );

        const { usedBytes = 0, usedCount = 0 } = result[0] || {};

        return {
            usedBytes: usedBytes || 0,
            usedCount: usedCount || 0,
            maxBytes: plan.limits.file_storage,
            maxCount: plan.limits.files,
        };
    }

    /**
     * Initiates a new file upload.
     */
    static async initiateUpload(params: {
        profileId: string;
        userId: string; // kept for R2 path generation
        displayName: string;
        mimeType: string;
        sizeBytes: number;
        clientIp: string;
    }) {
        const { profileId, userId, displayName, mimeType, sizeBytes, clientIp } = params;

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

        const quota = await this.getQuota(profileId);

        if (quota.usedCount >= quota.maxCount) {
            throw new Error(`Quota exceeded: maximum file count of ${quota.maxCount} reached.`);
        }

        if (quota.usedBytes + sizeBytes > quota.maxBytes) {
            throw new Error(`Quota exceeded: maximum file size of ${quota.maxBytes} bytes reached.`);
        }

        const [upload] = await db
            .insert(uploads)
            .values({
                profileId,
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

        // Generate a separate token for the client to upload the thumbnail
        const thumbnailToken = await uploadClient.createThumbnailToken({
            fileId: upload.id,
            userId,
            clientIp,
            mimeType: "image/jpeg",
            maxBytes: 200 * 1024, // 200KB hard limit for thumbnails
        });

        return { upload, ...uploadMetadata, thumbnailToken };
    }

    /**
     * Finalizes the upload by notifying the worker that all parts are sent.
     */
    static async completeUpload(profileId: string, userId: string, uploadId: string, session: MultipartSession) {
        // Verify upload belongs to profile and is pending
        const [upload] = await db
            .select()
            .from(uploads)
            .where(and(eq(uploads.id, uploadId), eq(uploads.profileId, profileId), eq(uploads.status, "pending")));

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
    static async abortUpload(profileId: string, userId: string, uploadId: string, r2UploadId: string) {
        const [upload] = await db
            .select()
            .from(uploads)
            .where(and(eq(uploads.id, uploadId), eq(uploads.profileId, profileId), eq(uploads.status, "pending")));

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
    static async deleteUpload(profileId: string, userId: string, uploadId: string) {
        const [upload] = await db
            .select()
            .from(uploads)
            .where(and(eq(uploads.id, uploadId), eq(uploads.profileId, profileId)));

        if (!upload) {
            throw new Error("Upload not found");
        }

        // Call R2 worker delete
        await uploadClient.deleteFile(userId, uploadId).catch((err) => {
            console.error("Failed to delete upload from worker", err);
        });

        await db.delete(uploads).where(eq(uploads.id, uploadId));

        return true;
    }

    /**
     * List profile uploads.
     */
    static async listUploads(profileId: string, userId: string) {
        const items = await db
            .select()
            .from(uploads)
            .where(and(eq(uploads.profileId, profileId), eq(uploads.status, "completed")))
            .orderBy(uploads.createdAt);

        return items.map((item) => ({
            ...item,
            url: uploadClient.fileUrl(userId, item.id),
            thumbnailUrl: uploadClient.thumbnailUrl(userId, item.id),
        }));
    }
}
