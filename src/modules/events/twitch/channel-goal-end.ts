import ChannelGoalProgress from './channel-goal-progress';

export default interface ChannelGoalEnd extends ChannelGoalProgress {
  ended_at: string;
  is_achieved: boolean;
}

export const SampleChannelGoalEnd: ChannelGoalEnd = {
  id: '123456789',
  broadcaster_user_id: '987654321',
  broadcaster_user_name: 'Broadcaster',
  broadcaster_user_login: 'broadcaster',
  type: 'bits',
  description: 'Bits Goal',
  current_amount: 1000,
  target_amount: 1000,
  started_at: '2021-01-01T00:00:00Z',
  ended_at: '2021-01-01T01:00:00Z',
  is_achieved: true,
};
