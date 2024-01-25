import { ApiClient } from '@twurple/api';
import { StaticAuthProvider } from '@twurple/auth';
import { EventSubWsListener } from '@twurple/eventsub-ws';

import { Integration } from '../integration/models/integration';
import SocketClientPool from './interfaces/SocketClientPool';

const NO_INTEGRATION = new Error('NO_INTEGRATION');

export function createPool(
  integration: Integration | null | undefined,
  userId: string,
): SocketClientPool {
  if (!integration) {
    throw NO_INTEGRATION;
  }

  const authProvider = new StaticAuthProvider(
    process.env.TWITCH_CLIENT_ID,
    integration.accessToken,
  );
  const apiClient = new ApiClient({ authProvider });
  const listener = new EventSubWsListener({ apiClient });
  listener.start();
  return {
    topics: new Map(),
    integrationUserId: integration.integrationId,
    sockets: new Set(),
    userId,
    apiClient,
    authProvider,
    listener,
  };
}
