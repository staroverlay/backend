import { Injectable, InternalServerErrorException } from '@nestjs/common';

@Injectable()
export class EventsService {
  private readonly EVENTSUB_URL = process.env['EVENTSUB_SERVER'];
  private readonly EVENTSUB_SECRET = process.env['EVENTSUB_TOKEN'];

  public async emit(widgetId: string, eventName: string, eventData: any) {
    const url = `${this.EVENTSUB_URL}/api/trigger/${widgetId}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Eventsub-Secret': this.EVENTSUB_SECRET,
      },
      body: JSON.stringify({
        data: eventData,
        event: eventName,
      }),
    }).catch((e) => {
      const isDev = process.env['NODE_ENV'] === 'development';
      const message = isDev ? e.message : 'Internal Server Error';
      if (isDev) {
        console.error(e);
      }
      throw new InternalServerErrorException(message);
    });

    return res;
  }

  public async emitDebugEvent(
    widgetId: string,
    eventName: string,
    eventData: any,
  ) {
    await this.emit(widgetId, `event:${eventName}`, {
      ...eventData,
      debug: true,
    });
  }

  public async emitSettingsUpdate(widgetId: string, settings: any) {
    await this.emit(widgetId, 'settings:update', settings);
  }
}
