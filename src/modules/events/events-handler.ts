import { EventSubSubscription } from '@twurple/eventsub-base';
import { EventSubWsListener } from '@twurple/eventsub-ws';

import { cloneObject } from '@/src/utils/objectUtils';

import Topic from '../shared/Topics';

type Callback = (userId: string, event: Topic, eventData: any) => unknown;

export default class EventsHandler {
  private readonly handler: Callback;
  private readonly pendingClose: Map<string, NodeJS.Timeout>;
  private readonly listeners: Map<string, EventSubSubscription<unknown>>;

  constructor(handler: Callback) {
    this.handler = handler;

    this.pendingClose = new Map();
    this.listeners = new Map();
  }

  craftHandler(userId: string, topic: Topic) {
    const crafted = (eventData: any) => {
      const data = cloneObject(eventData);
      this.handler(userId, topic, data);
    };
    return crafted;
  }

  public register(
    userId: string,
    integrationUserId: string,
    listener: EventSubWsListener,
    topic: Topic,
  ) {
    const id = `${userId}:${topic}`;

    if (this.pendingClose.has(id)) {
      clearTimeout(this.pendingClose.get(id));
      this.pendingClose.delete(id);
      return;
    }

    const handler = this.craftHandler(userId, topic);
    const eventSub = listenForEvent(
      listener,
      integrationUserId,
      topic,
      handler,
    );
    this.listeners.set(id, eventSub);
  }

  public unregister(userId: string, topic: Topic) {
    const id = `${userId}:${topic}`;
    if (this.pendingClose.has(id)) {
      return;
    }

    const timeout = setTimeout(() => {
      const listener = this.listeners.get(id);
      if (listener) {
        listener.stop();
        this.listeners.delete(id);
      }
      this.pendingClose.delete(id);
    }, 10 * 1000);
    this.pendingClose.set(id, timeout);
  }
}

function listenForEvent(
  listener: EventSubWsListener,
  userId: string,
  topic: Topic,
  handler: (any: any) => unknown,
) {
  switch (topic) {
    case 'settings:update':
      break;
    case 'twitch:ban':
      return listener.onChannelBan(userId, handler);
    case 'twitch:channel_update':
      return listener.onChannelUpdate(userId, handler);
    case 'twitch:charity_donation':
      return listener.onChannelCharityDonation(userId, handler);
    case 'twitch:charity_progress':
      return listener.onChannelCharityCampaignProgress(userId, handler);
    case 'twitch:charity_start':
      return listener.onChannelCharityCampaignStart(userId, handler);
    case 'twitch:charity_stop':
      return listener.onChannelCharityCampaignStop(userId, handler);
    case 'twitch:cheer':
      return listener.onChannelCheer(userId, handler);
    case 'twitch:follow':
      return listener.onChannelFollow(userId, userId, handler);
    case 'twitch:goal_begin':
      return listener.onChannelGoalBegin(userId, handler);
    case 'twitch:goal_end':
      return listener.onChannelGoalEnd(userId, handler);
    case 'twitch:goal_progress':
      return listener.onChannelGoalProgress(userId, handler);
    case 'twitch:hype_train_begin':
      return listener.onChannelHypeTrainBegin(userId, handler);
    case 'twitch:hype_train_end':
      return listener.onChannelHypeTrainEnd(userId, handler);
    case 'twitch:hype_train_progress':
      return listener.onChannelHypeTrainProgress(userId, handler);
    case 'twitch:mod_add':
      return listener.onChannelModeratorAdd(userId, handler);
    case 'twitch:mod_remove':
      return listener.onChannelModeratorRemove(userId, handler);
    case 'twitch:poll_begin':
      return listener.onChannelPollBegin(userId, handler);
    case 'twitch:poll_end':
      return listener.onChannelPollEnd(userId, handler);
    case 'twitch:poll_progress':
      return listener.onChannelPollProgress(userId, handler);
    case 'twitch:prediction_begin':
      return listener.onChannelPredictionBegin(userId, handler);
    case 'twitch:prediction_end':
      return listener.onChannelPredictionEnd(userId, handler);
    case 'twitch:prediction_lock':
      return listener.onChannelPredictionLock(userId, handler);
    case 'twitch:prediction_progress':
      return listener.onChannelPredictionProgress(userId, handler);
    case 'twitch:raid':
      return listener.onChannelRaidFrom(userId, handler);
    case 'twitch:raid_to':
      return listener.onChannelRaidTo(userId, handler);
    case 'twitch:redemption':
      return listener.onChannelRedemptionAdd(userId, handler);
    case 'twitch:redemption_update':
      return listener.onChannelRedemptionUpdate(userId, handler);
    case 'twitch:reward_add':
      return listener.onChannelRewardAdd(userId, handler);
    case 'twitch:reward_remove':
      return listener.onChannelRewardRemove(userId, handler);
    case 'twitch:reward_update':
      return listener.onChannelRewardUpdate(userId, handler);
    case 'twitch:shield_begin':
      return listener.onChannelShieldModeBegin(userId, userId, handler);
    case 'twitch:shield_end':
      return listener.onChannelShieldModeEnd(userId, userId, handler);
    case 'twitch:shoutout_create':
      return listener.onChannelShoutoutCreate(userId, userId, handler);
    case 'twitch:shoutout_receive':
      return listener.onChannelShoutoutReceive(userId, userId, handler);
    case 'twitch:stream_offline':
      return listener.onStreamOffline(userId, handler);
    case 'twitch:stream_online':
      return listener.onStreamOnline(userId, handler);
    case 'twitch:subscription':
      return listener.onChannelSubscription(userId, handler);
    case 'twitch:subscription_end':
      return listener.onChannelSubscriptionEnd(userId, handler);
    case 'twitch:subscription_gift':
      return listener.onChannelSubscriptionGift(userId, handler);
    case 'twitch:subscription_message':
      return listener.onChannelSubscriptionMessage(userId, handler);
    case 'twitch:unban':
      return listener.onChannelUnban(userId, handler);
    default:
      throw new Error('NO_TOPIC_' + topic);
  }
}
