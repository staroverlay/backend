export default interface ChannelUpdate {
  broadcaster_user_id: string;
  broadcaster_user_login: string;
  broadcaster_user_name: string;
  title: string;
  language: string;
  category_id: string;
  category_name: string;
  content_classification_labels: string[];
}

export const SampleChannelUpdate: ChannelUpdate = {
  broadcaster_user_id: '987654321',
  broadcaster_user_login: 'broadcaster',
  broadcaster_user_name: 'Broadcaster',
  title: 'New Title',
  language: 'en',
  category_id: '123456789',
  category_name: 'Just Chatting',
  content_classification_labels: ['Violence', 'Sexual Content'],
};
