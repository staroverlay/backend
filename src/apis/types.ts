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

export interface IProviderApiService {
    provider: string;
    getAuthUrl(state: string, type: "login" | "connect"): string;
    exchangeCode(code: string): Promise<OAuthTokenResponse>;
    refresh(refreshToken: string): Promise<OAuthTokenResponse>;
    fetchUser(accessToken: string): Promise<OAuthUserInfo>;
    getCacheTtlSeconds(): number;
}
