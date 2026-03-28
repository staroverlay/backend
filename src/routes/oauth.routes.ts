import Elysia, { t } from "elysia";

import {
    handleOAuthCallback,
    initiateOAuthLogin,
} from "@/services/integrations.service";
import { type OAuthProvider } from "@/services/oauth.service";
import { getClientMeta, handleServiceError } from "@/lib/request-helpers";

export const oauthRoutes = new Elysia({ prefix: "/oauth" })
    // Initiate login via OAuth (unauthenticated)
    .post(
        "/login/:provider",
        async ({ params, set }) => {
            try {
                return await initiateOAuthLogin(params.provider as OAuthProvider);
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

    // Callback (handles both login & connect)
    .get(
        "/callback/:provider",
        async ({ params, query, request, set }) => {
            const provider = params.provider as OAuthProvider;
            const { code, state, error: oauthError } = query;

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
            query: t.Object({
                code: t.Optional(t.String()),
                state: t.Optional(t.String()),
                error: t.Optional(t.String()),
            }),
        }
    );