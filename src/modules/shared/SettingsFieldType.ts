type SettingsFieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'map'
  | 'array'
  | 'enum'
  | 'platform:media'
  | 'platform:media.audio'
  | 'platform:media.image'
  | 'platform:media.video'
  | 'twitch:reward';

export default SettingsFieldType;
