import { Injectable } from '@nestjs/common';
import { TwitchAPI, TwitchUser } from 'twitch-api-ts';
import { TwitchOAuthResponse } from 'twitch-oauth';

import twitchAuth from '@/utils/twitchAuth';

@Injectable()
export class TwitchService {
  private readonly clientId: string;

  constructor() {
    this.clientId = process.env['TWITCH_CLIENT_ID'] as string;
  }

  getUserData(accessToken: string): Promise<TwitchUser> {
    return new TwitchAPI({
      accessToken,
      clientId: this.clientId,
    }).getCurrentUser();
  }

  verifyCode(code: string): Promise<TwitchOAuthResponse> {
    return twitchAuth.verifyCodeResponse(code);
  }
}
