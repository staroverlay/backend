export interface WidgetSettingsEmotes {
  _7tv: boolean;
  bttv: boolean;
  ffz: boolean;
  twitch: boolean;
}

export default interface WidgetSettings {
  emotes?: WidgetSettingsEmotes;
  mediaReward?: boolean;
}
