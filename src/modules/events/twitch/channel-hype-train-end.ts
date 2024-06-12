export default interface ChannelHypeTrainEnd {
  id: string;
  broadcaster_user_id: string;
  broadcaster_user_login: string;
  broadcaster_user_name: string;
  level: number;
  total: number;
  top_contributions: any[];
  started_at: string;
  ended_at: string;
  cooldown_ends_at: string;
}

export const SampleChannelHypeTrainEnd: ChannelHypeTrainEnd = {
  id: '123456789',
  broadcaster_user_id: '987654321',
  broadcaster_user_login: 'broadcaster',
  broadcaster_user_name: 'Broadcaster',
  level: 1,
  total: 1000,
  top_contributions: [],
  started_at: '2021-01-01T00:00:00Z',
  ended_at: '2021-01-01T01:00:00Z',
  cooldown_ends_at: '2021-01-01T02:00:00Z',
};
