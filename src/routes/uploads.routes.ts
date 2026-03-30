import Elysia, { t } from "elysia";
import { requireVerified } from "@/middlewares/auth";
import { handleServiceError } from "@/lib/request-helpers";
import { UploadsService } from "@/services/uploads.service";

export const uploadsRoutes = new Elysia({ prefix: "/uploads" })
    .use(requireVerified)

    .get("/quota", async ({ user, set }) => {
        try {
            return await UploadsService.getQuota(user!.id);
        } catch (e) {
            return handleServiceError(e, set);
        }
    })

    .get("/", async ({ user, set }) => {
        try {
            return await UploadsService.listUploads(user!.id);
        } catch (e) {
            return handleServiceError(e, set);
        }
    })

    .post(
        "/initiate",
        async ({ user, body, set, request }) => {
            try {
                // Determine client IP
                const clientIp = request.headers.get("x-forwarded-for") || "0.0.0.0";
                const result = await UploadsService.initiateUpload({
                    userId: user!.id,
                    displayName: body.displayName,
                    mimeType: body.mimeType,
                    sizeBytes: body.sizeBytes,
                    clientIp,
                });

                return { success: true, ...result };
            } catch (e) {
                return handleServiceError(e, set);
            }
        },
        {
            body: t.Object({
                displayName: t.String({ minLength: 1, maxLength: 255 }),
                mimeType: t.String({ minLength: 1, maxLength: 50 }),
                sizeBytes: t.Number({ min: 1, max: 50 * 1024 * 1024 }),
            }),
        }
    )

    .post(
        "/complete",
        async ({ user, body, set }) => {
            try {
                const result = await UploadsService.completeUpload(user!.id, body.uploadId, body.session);
                return { success: true, upload: result };
            } catch (e) {
                return handleServiceError(e, set);
            }
        },
        {
            body: t.Object({
                uploadId: t.String(),
                session: t.Object({
                    fileId: t.String(),
                    uploadId: t.String(),
                    key: t.String(),
                    uploadedParts: t.Array(
                        t.Object({
                            partNumber: t.Number(),
                            etag: t.String(),
                        })
                    ),
                }),
            }),
        }
    )

    .post(
        "/abort",
        async ({ user, body, set }) => {
            try {
                await UploadsService.abortUpload(user!.id, body.uploadId, body.r2UploadId);
                return { success: true };
            } catch (e) {
                return handleServiceError(e, set);
            }
        },
        {
            body: t.Object({
                uploadId: t.String(),
                r2UploadId: t.String(),
            }),
        }
    )

    .delete(
        "/:id",
        async ({ user, params, set }) => {
            try {
                await UploadsService.deleteUpload(user!.id, params.id);
                return { success: true };
            } catch (e) {
                return handleServiceError(e, set);
            }
        },
        {
            params: t.Object({
                id: t.String(),
            }),
        }
    );
