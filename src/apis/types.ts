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

export interface IProviderApiService {
    provider: string;
    getAuthUrl(state: string, type: "login" | "connect"): string;
    exchangeCode(code: string): Promise<OAuthTokenResponse>;
    refresh(refreshToken: string): Promise<OAuthTokenResponse>;
    fetchUser(accessToken: string): Promise<OAuthUserInfo>;
    fetchChannelRewards(accessToken: string, userId: string): Promise<NormalizedChannelReward[]>;
    getCacheTtlSeconds(): number;
}
