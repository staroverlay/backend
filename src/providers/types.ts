export interface OAuthTokenResponse {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    token_type: string;
}

export interface OAuthUserInfo {
    providerUserId: string;
    providerUsername: string;
    providerAvatarUrl?: string;
}

export interface NormalizedChannelReward {
    id: string;
    title: string;
    cost: number;
    color: string;
    icon: string | null;
}

export interface IntegrationForCreate {
    id: string;
    providerUserId: string;
    eventsubSecret: string;
}

export interface IntegrationForDelete {
    id: string;
    eventsubSubscriptions: string[];
}

export interface IntegrationForDispatch {
    id: string;
    provider: string;
    eventsubSubscriptions: string[];
}

export interface IOAuthProvider {
    getAuthUrl(state: string, type: "login" | "connect"): string;
    exchangeCode(code: string): Promise<OAuthTokenResponse>;
    refresh(refreshToken: string): Promise<OAuthTokenResponse>;
    fetchUser(accessToken: string): Promise<OAuthUserInfo>;
    getCacheTtlSeconds(): number;
}

export interface IWebhookProvider {
    createSubscriptions(integration: IntegrationForCreate): Promise<string[]>;
    deleteSubscriptions(integration: IntegrationForDelete): Promise<void>;
}

export interface IRewardProvider {
    fetchRewards(integrationId: string, providerUserId: string): Promise<NormalizedChannelReward[]>;
}

export interface IntegrationProvider extends IOAuthProvider, Partial<IWebhookProvider>, Partial<IRewardProvider> {
    readonly name: string;
}
