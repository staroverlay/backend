import { ApiClient } from '@twurple/api';
import { StaticAuthProvider } from '@twurple/auth';
import { EventSubWsListener } from '@twurple/eventsub-ws';

import Topic from '../../shared/Topics';
import SocketClient from './SocketClient';

export default interface SocketClientPool {
  // Subscription state.
  topics: Map<Topic, number>;
  sockets: Set<SocketClient>;

  // Client common.
  integrationUserId: string;
  userId: string;

  // Twitch API
  authProvider: StaticAuthProvider;
  apiClient: ApiClient;
  listener: EventSubWsListener;
}
