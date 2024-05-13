export default interface ChannelModeratorRemove {
  broadcaster_user_id: string;
  broadcaster_user_login: string;
  broadcaster_user_name: string;
  user_id: string;
  user_login: string;
  user_name: string;
}

export const SampleChannelModeratorRemove: ChannelModeratorRemove = {
  broadcaster_user_id: '987654321',
  broadcaster_user_login: 'broadcaster',
  broadcaster_user_name: 'Broadcaster',
  user_id: '123456789',
  user_login: 'user',
  user_name: 'User',
};
