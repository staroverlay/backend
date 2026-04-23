import { TwitchProvider } from "./twitch/twitch.provider";
import { KickProvider } from "./kick/kick.provider";
import { YouTubeProvider } from "./youtube/youtube.provider";
import type { IntegrationProvider } from "./types";

export const providers: Record<string, IntegrationProvider> = {
    twitch: new TwitchProvider(),
    kick: new KickProvider(),
    youtube: new YouTubeProvider(),
};

// Aliases for compatibility
export const webhookProviders = providers;
export const rewardProviders = providers;

export * from "./types";
