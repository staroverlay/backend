import { Injectable } from '@nestjs/common';
import { TwitchAPI, TwitchUser } from 'twitch-api-ts';
import { TwitchOAuth, TwitchOAuthResponse } from 'twitch-oauth';

@Injectable()
export class TwitchService {
  private readonly clientId: string;
  private readonly oauth: TwitchOAuth;

  constructor() {
    this.clientId = process.env['TWITCH_CLIENT_ID'] as string;
    this.oauth = new TwitchOAuth({
      clientId: this.clientId,
      clientSecret: process.env['TWITCH_CLIENT_SECRET'] as string,
      redirectUri: '',
      scope: [
        'bits:read',
        'channel:manage:redemptions',
        'channel:read:goals',
        'channel:read:hype_train',
        'channel:read:polls',
        'channel:read:predictions',
        'channel:read:redemptions',
        'channel:read:subscriptions',
        'chat:read',
        'user:read:broadcast',
        'user:read:email',
      ],
    });
  }

  getUserData(accessToken: string): Promise<TwitchUser> {
    return new TwitchAPI({
      accessToken,
      clientId: this.clientId,
    }).getCurrentUser();
  }

  verifyCode(code: string): Promise<TwitchOAuthResponse> {
    return this.oauth.verifyCodeResponse(code);
  }
}
