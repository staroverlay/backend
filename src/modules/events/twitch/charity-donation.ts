export default interface ChannelDonation {
  id: string;
  campaign_id: string;
  broadcaster_user_id: string;
  broadcaster_user_login: string;
  broadcaster_user_name: string;
  user_id: string;
  user_login: string;
  user_name: string;
  charity_name: string;
  charity_description: string;
  charity_logo: string;
  charity_website: string;
  value: number;
  decimal_places: number;
  currency: string;
}

export const SampleChannelDonation: ChannelDonation = {
  id: '123456789',
  campaign_id: '987654321',
  broadcaster_user_id: '987654321',
  broadcaster_user_login: 'broadcaster',
  broadcaster_user_name: 'Broadcaster',
  user_id: '123456789',
  user_login: 'user',
  user_name: 'User',
  charity_name: 'Charity',
  charity_description: 'Charity Description',
  charity_logo: 'https://example.com/charity.png',
  charity_website: 'https://example.com/charity',
  value: 100,
  decimal_places: 2,
  currency: 'USD',
};
