import { TwitchOAuth } from 'twitch-oauth';

const twitchAuth = new TwitchOAuth({
  clientId: process.env['TWITCH_CLIENT_ID'] as string,
  clientSecret: process.env['TWITCH_CLIENT_SECRET'] as string,
  redirectUri: process.env['TWITCH_REDIRECT_URI'] as string,
  scope: [
    'bits:read',
    'channel:edit:commercial',
    'channel:manage:broadcast',
    'channel:manage:moderators',
    'channel:manage:polls',
    'channel:manage:predictions',
    'channel:manage:raids',
    'channel:manage:redemptions',
    'channel:manage:vips',
    'channel:read:goals',
    'channel:read:hype_train',
    'channel:read:polls',
    'channel:read:predictions',
    'channel:read:redemptions',
    'channel:read:subscriptions',
    'chat:read',
    'moderation:read',
    'moderator:manage:shoutouts',
    'user:read:broadcast',
    'user:read:email',
    'moderator:read:followers'
  ],
});

export default twitchAuth;
