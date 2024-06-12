import ChannelPollProgress from './channel-poll-progress';

type ChannelPollEnd = Omit<ChannelPollProgress, 'ends_at'>;

export default ChannelPollEnd;
