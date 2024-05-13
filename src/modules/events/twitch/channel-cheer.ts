export default interface ChannelCheer {
  is_anonymous: boolean;
  user_id: string;
  user_login: string;
  user_name: string;
  broadcaster_user_id: string;
  broadcaster_user_login: string;
  broadcaster_user_name: string;
  message: string;
  bits: number;
}

export const SampleChannelCheer: ChannelCheer = {
  is_anonymous: false,
  user_id: '123456789',
  user_login: 'user',
  user_name: 'User',
  broadcaster_user_id: '987654321',
  broadcaster_user_login: 'broadcaster',
  broadcaster_user_name: 'Broadcaster',
  message: 'cheer100 Hello World!',
  bits: 100,
};
