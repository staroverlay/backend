import Elysia, { t } from "elysia";

import { requireVerified } from "@/middlewares/auth";
import {
    listIntegrations,
    getIntegration,
    updateIntegration,
    disconnectIntegration,
    refreshIntegration,
    initiateOAuthConnect,
    getChannelRewards,
    getChannelRewardsById,
} from "@/services/integrations.service";
import { type IntegrationProvider } from "@/services/integrations.service";
import { handleServiceError } from "@/lib/request-helpers";

const providerParam = t.Union([
    t.Literal("twitch"),
    t.Literal("kick"),
    t.Literal("youtube"),
]);

export const integrationsRoutes = new Elysia({ prefix: "/integrations" })
    .use(requireVerified)

    // List integrations
    .get("/", async ({ user }) => {
        const integrations = await listIntegrations(user!.profile.id);
        return { integrations };
    })

    // Get single integration
    .get(
        "/:provider",
        async ({ user, params, set }) => {
            try {
                return await getIntegration(user!.profile.id, params.provider as IntegrationProvider);
            } catch (e) {
                return handleServiceError(e, set);
            }
        },
        { params: t.Object({ provider: providerParam }) }
    )

    // Get provider channel rewards (if supported)
    .get(
        "/:provider/rewards",
        async ({ user, params, set }) => {
            try {
                const rewards = await getChannelRewards(user!.profile.id, params.provider as IntegrationProvider);
                return { rewards };
            } catch (e) {
                return handleServiceError(e, set);
            }
        },
        { params: t.Object({ provider: providerParam }) }
    )

    // Get rewards by integration ID (UUID)
    .get(
        "/rewards/:id",
        async ({ user, params, set }) => {
            try {
                const rewards = await getChannelRewardsById(user!.profile.id, params.id);
                return { rewards };
            } catch (e) {
                return handleServiceError(e, set);
            }
        },
        { params: t.Object({ id: t.String() }) }
    )

    // Update integration display name + allowOauthLogin
    .patch(
        "/:provider",
        async ({ user, params, body, set }) => {
            try {
                const updated = await updateIntegration(
                    user!.profile.id,
                    params.provider as IntegrationProvider,
                    body
                );
                return { success: true, integration: updated };
            } catch (e) {
                return handleServiceError(e, set);
            }
        },
        {
            params: t.Object({ provider: providerParam }),
            body: t.Object({
                displayName: t.Optional(t.Nullable(t.String({ maxLength: 64 }))),
                allowOauthLogin: t.Optional(t.Boolean()),
                isActive: t.Optional(t.Boolean()),
            }),
        }
    )

    // Refresh provider token
    .post(
        "/:provider/refresh",
        async ({ user, params, set }) => {
            try {
                const result = await refreshIntegration(user!.profile.id, params.provider as IntegrationProvider);
                return { success: true, message: "Integration refreshed", ...result };
            } catch (e) {
                return handleServiceError(e, set);
            }
        },
        { params: t.Object({ provider: providerParam }) }
    )

    // Disconnect integration
    .delete(
        "/:provider",
        async ({ user, params, set }) => {
            try {
                await disconnectIntegration(user!.profile.id, params.provider as IntegrationProvider);
                return { success: true, message: `${params.provider} disconnected` };
            } catch (e) {
                return handleServiceError(e, set);
            }
        },
        { params: t.Object({ provider: providerParam }) }
    )

    // Initiate OAuth connect (authenticated user connecting an integration)
    .post(
        "/:provider/connect",
        async ({ user, params, set }) => {
            try {
                return await initiateOAuthConnect(user!.profile.id, params.provider as IntegrationProvider);
            } catch (e) {
                return handleServiceError(e, set);
            }
        },
        { params: t.Object({ provider: providerParam }) }
    );
