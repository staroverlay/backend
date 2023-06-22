type SettingsScope =
  | 'platform:storage'
  | 'twitch:chat'
  | 'twitch:emotes'
  | 'twitch:subscription'
  | 'twitch:sub-gift'
  | 'twitch:bits'
  | 'twitch:follow'
  | 'twitch:points_redemption'
  | 'twitch:pool'
  | 'twitch:prediction'
  | 'twitch:stream-up';

export const SettingsScopes = [
  'platform:storage',
  'twitch:chat',
  'twitch:emotes',
  'twitch:subscription',
  'twitch:sub-gift',
  'twitch:bits',
  'twitch:follow',
  'twitch:points_redemption',
  'twitch:pool',
  'twitch:prediction',
  'twitch:stream-up',
];

export default SettingsScope;
