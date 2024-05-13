export default interface ChannelFollow {
  user_id: string;
  user_login: string;
  user_name: string;
  broadcaster_user_id: string;
  broadcaster_user_login: string;
  broadcaster_user_name: string;
  followed_at: string;
}

export const SampleChannelFollow: ChannelFollow = {
  user_id: '123456789',
  user_login: 'user',
  user_name: 'User',
  broadcaster_user_id: '987654321',
  broadcaster_user_login: 'broadcaster',
  broadcaster_user_name: 'Broadcaster',
  followed_at: '2021-01-01T00:00:00Z',
};
