import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';

import Topic from '../shared/Topics';
import { TemplateVersionService } from '../template-version/template-version.service';
import { TemplateService } from '../templates/template.service';
import { UsersService } from '../users/users.service';
import { WidgetsService } from '../widgets/widgets.service';
import { EventsService } from './events.service';
import SocketClient from './interfaces/SocketClient';

@WebSocketGateway()
export class EventsGateway {
  private readonly rawSockets: Map<string, SocketClient>;
  private readonly busySockets: Set<string>;

  constructor(
    private readonly eventsService: EventsService,
    private readonly widgetsService: WidgetsService,
    private readonly templateService: TemplateService,
    private readonly templateVersionService: TemplateVersionService,
    private readonly usersService: UsersService,
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

    const user = await this.usersService.getByProfileID(widget.ownerId);
    if (!user) {
      socket.emit('error', 'BAD_USER');
      socket.disconnect();
      this.busySockets.delete(socketID);
      return;
    }

    const { autoUpdate, templateId, templateVersion } = widget;
    const settings = JSON.parse(widget.settings || '{}');

    const template = await this.templateService.getTemplateById(templateId);
    if (!template) {
      socket.emit('error', 'BAD_TEMPLATE');
      socket.disconnect();
      this.busySockets.delete(socketID);
      return;
    }

    const desiredVersionId =
      !autoUpdate && templateVersion ? templateVersion : template.lastVersionId;

    const version = await this.templateVersionService.getTemplateVersion(
      template._id,
      desiredVersionId,
    );

    if (!version) {
      socket.emit('error', 'BAD_TEMPLATE_VERSION');
      socket.disconnect();
      this.busySockets.delete(socketID);
      return;
    }

    const client: SocketClient = {
      scopes: version.scopes || [],
      service: widget.service,
      socket,
      topics: [],
      profileId: widget.ownerId,
      widgetId: widget._id,
      userId: user._id,
    };

    this.rawSockets.set(socket.id, client);
    this.busySockets.delete(socketID);

    try {
      await this.eventsService.addClient(client);
      socket.emit('success', {
        widget: {
          _id: widget._id,
          displayName: widget.displayName,
          service: widget.service,
          settings,
          profileId: widget.ownerId,
        },
        template,
        version,
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
    console.log(topics);
  }
}
