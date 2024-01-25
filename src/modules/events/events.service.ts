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
    const { userId } = client;
    const pool = this.clients.get(userId);
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
            userId,
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
    const { userId } = client;

    // Delete client from socket pool.
    const pool = this.clients.get(userId);
    pool.sockets.delete(client);
    if (pool.sockets.size == 0) {
      // Delete the pool if is empty.
      this.clients.delete(userId);
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
    const { userId, service } = client;
    let pool: SocketClientPool = this.clients.get(userId);

    // Create default pool if not exist.
    if (!pool) {
      const integration = await this.integrationService.getByOwnerIdAndType(
        userId,
        service,
      );
      pool = createPool(integration, userId);
      this.clients.set(userId, pool);
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
