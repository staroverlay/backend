import { Injectable } from '@nestjs/common';

import { IntegrationService } from '../integration/integration.service';
import Topic from '../shared/Topics';
import EventsHandler from './events-handler';
import { createPool } from './events-utils';
import SocketClient from './interfaces/SocketClient';
import {
  default as SocketClientPool,
  default as SubscriptionClient,
} from './interfaces/SocketClientPool';

@Injectable()
export class EventsService {
  private readonly clients: Map<string, SubscriptionClient>;
  private readonly handler: EventsHandler;

  constructor(private readonly integrationService: IntegrationService) {
    this.emit = this.emit.bind(this);

    this.clients = new Map();
    this.handler = new EventsHandler(this.emit);
  }

  async listenTopic(client: SocketClient, topics: Topic[]) {
    const { profileId } = client;
    const pool = this.clients.get(profileId);
    const poolTopics = pool.topics;

    for (const topic of topics) {
      if (client.topics.includes(topic)) {
        client.socket.emit('error', 'ALREADY_SUBSCRIBED_' + topic);
        continue;
      }

      if (poolTopics.has(topic)) {
        const refCount = poolTopics.get(topic);
        poolTopics.set(topic, refCount + 1);
      } else {
        poolTopics.set(topic, 1);

        try {
          this.handler.register(
            profileId,
            pool.integrationUserId,
            pool.listener,
            topic,
          );
        } catch (e) {
          client.socket.emit('error', e.message);
        }
      }

      client.topics.push(topic);
    }
  }

  public removeClient(client: SocketClient) {
    const { profileId } = client;

    // Delete client from socket pool.
    const pool = this.clients.get(profileId);
    pool.sockets.delete(client);
    if (pool.sockets.size == 0) {
      // Delete the pool if is empty.
      this.clients.delete(profileId);
    }

    // Unregister subscribed topics.
    const clientTopics = client.topics;
    const poolTopics = pool.topics;

    for (const topic of clientTopics) {
      if (poolTopics.has(topic)) {
        const refCount = poolTopics.get(topic);

        // Remove 1 to counter if more than 1 client has registered the topic.
        if (refCount > 1) {
          poolTopics.set(topic, refCount - 1);
        } else {
          // Otherwise, delete the refCount for current topic.
          poolTopics.delete(topic);

          // Remove handler listener.
          this.handler.unregister(pool.userId, topic);
        }
      }
    }
  }

  async addClient(client: SocketClient) {
    const { profileId, service } = client;
    let pool: SocketClientPool = this.clients.get(profileId);

    // Create default pool if not exist.
    if (!pool) {
      const integration = await this.integrationService.getByOwnerIdAndType(
        profileId,
        service,
      );
      pool = createPool(integration, profileId);
      this.clients.set(profileId, pool);
    }

    // Add new client to the pool.
    pool.sockets.add(client);
  }

  public async emit(
    userId: string,
    topic: Topic,
    eventData: any,
    bypassSubscription = false,
  ) {
    const pool = this.clients.get(userId);
    if (!pool) return;

    for (const client of pool.sockets) {
      if (bypassSubscription || client.topics.includes(topic)) {
        client.socket.emit('event', {
          data: eventData,
          topic,
        });
      }
    }
  }

  public async emitSettingsUpdate(widgetId: string, settings: any) {
    await this.emit(widgetId, 'settings:update', settings, true);
  }
}
