export default interface ChannelHypeTrainBegin {
  id: string;
  broadcaster_user_id: string;
  broadcaster_user_login: string;
  broadcaster_user_name: string;
  total: number;
  progress: number;
  goal: number;
  top_contributions: any[];
  last_contribution: any;
  level: number;
  started_at: string;
  expires_at: string;
}

export const SampleChannelHypeTrainBegin: ChannelHypeTrainBegin = {
  id: '123456789',
  broadcaster_user_id: '987654321',
  broadcaster_user_login: 'broadcaster',
  broadcaster_user_name: 'Broadcaster',
  total: 1000,
  progress: 100,
  goal: 200,
  top_contributions: [],
  last_contribution: {},
  level: 1,
  started_at: '2021-01-01T00:00:00Z',
  expires_at: '2021-01-01T01:00:00Z',
};
