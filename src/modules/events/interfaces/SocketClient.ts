import { Socket } from 'socket.io';

import SettingsScope from '../../shared/SettingsScope';
import SettingsService from '../../shared/SettingsService';
import Topic from '../../shared/Topics';

export default interface SocketClient {
  socket: Socket;
  scopes: SettingsScope[];
  topics: Topic[];
  service: SettingsService;
  profileId: string;
  widgetId: string;
  userId: string;
}
