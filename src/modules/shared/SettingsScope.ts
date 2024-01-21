type SettingsScope =
  | 'platform:storage'
  | 'twitch:cheer'
  | 'twitch:follow'
  | 'twitch:goal'
  | 'twitch:hype_train'
  | 'twitch:poll'
  | 'twitch:raid'
  | 'twitch:redemption'
  | 'twitch:shoutout'
  | 'twitch:subscription'
  | 'twitch:stream';

export const SettingsScopes = [
  'platform:storage',
  'twitch:unban',
  'twitch:cheer',
  'twitch:follow',
  'twitch:goal',
  'twitch:hype_train',
  'twitch:poll',
  'twitch:raid',
  'twitch:redemption',
  'twitch:shoutout',
  'twitch:subscription',
  'twitch:stream',
];

export default SettingsScope;
