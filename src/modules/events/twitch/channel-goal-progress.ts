export default interface ChannelGoalProgress {
  id: string;
  broadcaster_user_id: string;
  broadcaster_user_name: string;
  broadcaster_user_login: string;
  type: string;
  description: string;
  current_amount: number;
  target_amount: number;
  started_at: string;
}

export const SampleChannelGoalProgress: ChannelGoalProgress = {
  id: '123456789',
  broadcaster_user_id: '987654321',
  broadcaster_user_name: 'Broadcaster',
  broadcaster_user_login: 'broadcaster',
  type: 'bits',
  description: 'Bits Goal',
  current_amount: 100,
  target_amount: 1000,
  started_at: '2021-01-01T00:00:00Z',
};
