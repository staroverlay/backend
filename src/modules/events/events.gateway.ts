import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';

import Topic from '../shared/Topics';
import { WidgetsService } from '../widgets/widgets.service';
import { EventsService } from './events.service';
import SocketClient from './interfaces/SocketClient';

@WebSocketGateway()
export class EventsGateway {
  @WebSocketServer()
  private server: Socket;
  private readonly rawSockets: Map<string, SocketClient>;
  private readonly busySockets: Set<string>;

  constructor(
    private readonly eventsService: EventsService,
    private readonly widgetsService: WidgetsService,
  ) {
    this.rawSockets = new Map();
    this.busySockets = new Set();
  }

  @SubscribeMessage('auth')
  async handleAuth(
    @ConnectedSocket() socket: Socket,
    @MessageBody() token: string,
  ) {
    const socketID = socket.id;

    if (this.rawSockets.has(socketID) || this.busySockets.has(socketID)) {
      socket.emit('error', 'ALREADY_AUTH');
      return;
    } else {
      this.busySockets.add(socketID);
    }

    const widget = await this.widgetsService.getWidgetByToken(token);
    if (!widget) {
      socket.emit('error', 'BAD_AUTH');
      socket.disconnect();
      this.busySockets.delete(socketID);
      return;
    }

    const { displayName, service, userId, scopes, _id } = widget;
    const settings = JSON.parse(widget.settings || '{}');
    const template = JSON.parse(widget.templateRaw);

    const client: SocketClient = {
      scopes,
      service,
      socket,
      topics: [],
      userId,
      widgetId: _id,
    };

    this.rawSockets.set(socket.id, client);
    this.busySockets.delete(socketID);

    try {
      await this.eventsService.addClient(client);
      socket.emit('success', {
        _id,
        displayName,
        service,
        settings,
        template,
        userId,
      });
    } catch (e) {
      socket.emit('error', e.message);
    }
  }

  @SubscribeMessage('disconnect')
  handleDisconnect(@ConnectedSocket() socket: Socket) {
    const client = this.rawSockets.get(socket.id);
    if (client) {
      this.eventsService.removeClient(client);
    }
  }

  @SubscribeMessage('subscribe')
  async handleListen(
    @ConnectedSocket() socket: Socket,
    @MessageBody() topics: string[],
  ) {
    const client = this.rawSockets.get(socket.id);
    if (!client) {
      socket.emit('error', 'NO_AUTH');
      return;
    }

    this.eventsService.listenTopic(client, topics as Topic[]);
  }
}
