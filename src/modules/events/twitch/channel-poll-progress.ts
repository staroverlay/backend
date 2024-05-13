export default interface ChannelPollProgress {
  id: string;
  broadcaster_user_id: string;
  broadcaster_user_login: string;
  broadcaster_user_name: string;
  title: string;
  choices: Choice[];
  bits_voting: BitsVoting;
  channel_points_voting: ChannelPointsVoting;
  status: 'completed' | 'archived' | 'terminated';
  started_at: string;
  ends_at: string;
}

export interface Choice {
  id: string;
  title: string;
  bits_votes: number;
  channel_points_votes: number;
  votes: number;
}

export interface ChannelPointsVoting {
  is_enabled: boolean;
  amount_per_vote: number;
}

export interface BitsVoting {
  is_enabled: boolean;
  amount_per_vote: number;
}

export const SampleChannelPollProgress: ChannelPollProgress = {
  id: '123456789',
  broadcaster_user_id: '987654321',
  broadcaster_user_login: 'broadcaster',
  broadcaster_user_name: 'Broadcaster',
  title: 'What should I play next?',
  choices: [
    {
      id: '1',
      title: 'Game 1',
      bits_votes: 0,
      channel_points_votes: 0,
      votes: 0,
    },
    {
      id: '2',
      title: 'Game 2',
      bits_votes: 0,
      channel_points_votes: 0,
      votes: 0,
    },
  ],
  bits_voting: {
    is_enabled: false,
    amount_per_vote: 0,
  },
  channel_points_voting: {
    is_enabled: true,
    amount_per_vote: 100,
  },
  status: 'completed',
  started_at: '2021-01-01T00:00:00Z',
  ends_at: '2021-01-01T01:00:00Z',
};
