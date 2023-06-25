import { Controller, Get, NotFoundException, Param } from '@nestjs/common';

import { WidgetsService } from './widgets.service';

@Controller('/widgets')
export class WidgetsController {
  constructor(private readonly widgetsService: WidgetsService) {}

  @Get('/:token')
  async getWidgetByToken(@Param('token') token: string) {
    const widget = await this.widgetsService.getWidgetByToken(token);

    if (!widget) {
      throw new NotFoundException('Widget not found');
    }

    return widget;
  }
}
