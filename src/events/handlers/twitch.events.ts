/**
 * TWITCH EVENTSUB TOPIC MAP
 *
 * Maps a short client-facing event name to the full Twitch EventSub
 * subscription type and version. The broadcaster/user ID is always pulled
 * from `integration.providerUserId` — the client never supplies it.
 *
 * Reference: https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/
 */

export interface TwitchEventDef {
    /** The official Twitch EventSub type string */
    type: string;
    /** EventSub schema version */
    version: string;
    /**
     * Builds the `condition` object that Twitch expects.
     * `channelId` is always `integration.providerUserId`.
     */
    condition: (channelId: string) => Record<string, string>;
}

export const TWITCH_EVENT_MAP: Record<string, TwitchEventDef> = {
    // Chat
    "chat.message": {
        type: "channel.chat.message",
        version: "1",
        condition: (id) => ({ broadcaster_user_id: id, user_id: id }),
    },

    // Subscriptions
    "channel.subscribe": {
        type: "channel.subscribe",
        version: "1",
        condition: (id) => ({ broadcaster_user_id: id }),
    },
    "channel.subscription.gift": {
        type: "channel.subscription.gift",
        version: "1",
        condition: (id) => ({ broadcaster_user_id: id }),
    },
    "channel.subscription.message": {
        type: "channel.subscription.message",
        version: "1",
        condition: (id) => ({ broadcaster_user_id: id }),
    },

    // Bits
    "channel.cheer": {
        type: "channel.cheer",
        version: "1",
        condition: (id) => ({ broadcaster_user_id: id }),
    },

    // Follows / Raids
    "channel.follow": {
        type: "channel.follow",
        version: "2",
        condition: (id) => ({ broadcaster_user_id: id, moderator_user_id: id }),
    },
    "channel.raid": {
        type: "channel.raid",
        version: "1",
        condition: (id) => ({ to_broadcaster_user_id: id }),
    },

    // Channel Points
    "channel.channel_points_custom_reward_redemption.add": {
        type: "channel.channel_points_custom_reward_redemption.add",
        version: "1",
        condition: (id) => ({ broadcaster_user_id: id }),
    },

    // Polls & Predictions
    "channel.poll.begin": {
        type: "channel.poll.begin",
        version: "1",
        condition: (id) => ({ broadcaster_user_id: id }),
    },
    "channel.poll.end": {
        type: "channel.poll.end",
        version: "1",
        condition: (id) => ({ broadcaster_user_id: id }),
    },
    "channel.prediction.begin": {
        type: "channel.prediction.begin",
        version: "1",
        condition: (id) => ({ broadcaster_user_id: id }),
    },
    "channel.prediction.end": {
        type: "channel.prediction.end",
        version: "1",
        condition: (id) => ({ broadcaster_user_id: id }),
    },

    // Stream status
    "stream.online": {
        type: "stream.online",
        version: "1",
        condition: (id) => ({ broadcaster_user_id: id }),
    },
    "stream.offline": {
        type: "stream.offline",
        version: "1",
        condition: (id) => ({ broadcaster_user_id: id }),
    },

    // Hype Train
    "channel.hype_train.begin": {
        type: "channel.hype_train.begin",
        version: "1",
        condition: (id) => ({ broadcaster_user_id: id }),
    },
    "channel.hype_train.end": {
        type: "channel.hype_train.end",
        version: "1",
        condition: (id) => ({ broadcaster_user_id: id }),
    },

    // Goals
    "channel.goal.begin": {
        type: "channel.goal.begin",
        version: "1",
        condition: (id) => ({ broadcaster_user_id: id }),
    },
    "channel.goal.end": {
        type: "channel.goal.end",
        version: "1",
        condition: (id) => ({ broadcaster_user_id: id }),
    },
};
