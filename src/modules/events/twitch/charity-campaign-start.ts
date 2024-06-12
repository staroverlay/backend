export default interface CharityCampaignStart {
  id: string;
  broadcaster_id: string;
  broadcaster_login: string;
  broadcaster_name: string;
  charity_name: string;
  charity_description: string;
  charity_logo: string;
  charity_website: string;
  current_amount: {
    value: number;
    decimal_places: number;
    currency: string;
  };
  target_amount: {
    value: number;
    decimal_places: number;
    currency: string;
  };
  started_at: string;
}

export const SampleCharityCampaignStart: CharityCampaignStart = {
  id: '123456789',
  broadcaster_id: '987654321',
  broadcaster_login: 'broadcaster',
  broadcaster_name: 'Broadcaster',
  charity_name: 'Charity',
  charity_description: 'Charity Description',
  charity_logo: 'https://example.com/charity.png',
  charity_website: 'https://example.com/charity',
  current_amount: {
    value: 100,
    decimal_places: 2,
    currency: 'USD',
  },
  target_amount: {
    value: 1000,
    decimal_places: 2,
    currency: 'USD',
  },
  started_at: '2021-01-01T00:00:00Z',
};
