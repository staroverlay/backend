import Elysia, { t } from "elysia";

import {
    handleOAuthCallback,
    initiateOAuthLogin,
    type IntegrationProvider,
} from "@/services/integrations.service";
import { providersMap } from "@/services/token-manager.service";
import { getClientMeta, handleServiceError } from "@/lib/request-helpers";

export const oauthRoutes = new Elysia({ prefix: "/oauth" })
    // Initiate login via OAuth
    .post(
        "/:provider/login",
        async ({ params, set }) => {
            try {
                return await initiateOAuthLogin(params.provider as IntegrationProvider);
            } catch (e) {
                return handleServiceError(e, set);
            }
        },
        {
            params: t.Object({
                provider: t.Union([
                    t.Literal("twitch"),
                    t.Literal("kick"),
                    t.Literal("youtube"),
                ]),
            }),
        }
    )

    // Callback handler
    .post(
        "/callback/:provider",
        async ({ params, body, request, set }) => {
            const provider = params.provider as IntegrationProvider;

            // Strict validation: Provider must be configured
            if (!providersMap[provider]) {
                set.status = 400;
                return { error: `Provider ${provider} is not configured or supported` };
            }

            const { code, state, error: oauthError } = body;

            if (oauthError) {
                set.status = 400;
                return { error: `OAuth error: ${oauthError}` };
            }

            if (!code || !state) {
                set.status = 400;
                return { error: "Missing code or state" };
            }

            try {
                const result = await handleOAuthCallback(
                    provider,
                    code,
                    state,
                    getClientMeta(request)
                );

                if (result.type === "login") {
                    const { type, ...tokens } = result;
                    return { success: true, ...tokens };
                } else {
                    return {
                        success: true,
                        connected: true,
                        provider: result.provider,
                        username: result.username
                    };
                }
            } catch (e) {
                return handleServiceError(e, set);
            }
        },

        {
            params: t.Object({
                provider: t.Union([
                    t.Literal("twitch"),
                    t.Literal("kick"),
                    t.Literal("youtube"),
                ]),
            }),
            body: t.Object({
                code: t.String(),
                state: t.String(),
                error: t.Optional(t.String()),
            }),
        }
    );
