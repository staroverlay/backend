export default interface ChannelBan {
  user_id: string;
  user_login: string;
  user_name: string;
  broadcaster_user_id: string;
  broadcaster_user_login: string;
  broadcaster_user_name: string;
  moderator_user_id: string;
  moderator_user_login: string;
  moderator_user_name: string;
  reason: string;
  banned_at: string;
  ends_at: string | null;
  is_permanent: boolean;
}

export const SampleChannelBan: ChannelBan = {
  user_id: '123456789',
  user_login: 'twitchuser',
  user_name: 'TwitchUser',
  broadcaster_user_id: '987654321',
  broadcaster_user_login: 'broadcaster',
  broadcaster_user_name: 'Broadcaster',
  moderator_user_id: '987654321',
  moderator_user_login: 'broadcaster',
  moderator_user_name: 'Broadcaster',
  reason: 'Spamming',
  banned_at: '2021-01-01T00:00:00Z',
  ends_at: null,
  is_permanent: true,
};
