import ChannelGoalProgress from './channel-goal-progress';

export type ChannelGoalBegin = ChannelGoalProgress;

export const SampleChannelGoalBegin: ChannelGoalBegin = {
  id: '123456789',
  broadcaster_user_id: '987654321',
  broadcaster_user_name: 'Broadcaster',
  broadcaster_user_login: 'broadcaster',
  type: 'bits',
  description: 'Bits Goal',
  current_amount: 0,
  target_amount: 1000,
  started_at: '2021-01-01T00:00:00Z',
};
