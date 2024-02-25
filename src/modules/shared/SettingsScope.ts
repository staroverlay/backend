type SettingsScope =
  | 'twitch:ban'
  | 'twitch:channel_update'
  | 'twitch:charity'
  | 'twitch:cheer'
  | 'twitch:follow'
  | 'twitch:goal'
  | 'twitch:hype_train'
  | 'twitch:mod'
  | 'twitch:poll'
  | 'twitch:prediction'
  | 'twitch:raid'
  | 'twitch:channel_points'
  | 'twitch:shield'
  | 'twitch:shoutout'
  | 'twitch:subscription';

export const SettingsScopes: SettingsScope[] = [
  'twitch:ban',
  'twitch:channel_points',
  'twitch:channel_update',
  'twitch:charity',
  'twitch:cheer',
  'twitch:follow',
  'twitch:goal',
  'twitch:hype_train',
  'twitch:mod',
  'twitch:poll',
  'twitch:prediction',
  'twitch:raid',
  'twitch:shield',
  'twitch:shoutout',
  'twitch:subscription',
];

export default SettingsScope;
