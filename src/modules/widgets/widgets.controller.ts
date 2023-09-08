import { Controller, Get, NotFoundException, Param } from '@nestjs/common';

import { WidgetsService } from './widgets.service';
import { Template } from '../templates/models/template';

@Controller('/widgets')
export class WidgetsController {
  constructor(private readonly widgetsService: WidgetsService) {}

  @Get('/:token')
  async getWidgetByToken(@Param('token') token: string) {
    const widget = await this.widgetsService.getWidgetByToken(token);

    if (!widget) {
      throw new NotFoundException('Widget not found');
    }

    const template: Template = JSON.parse(widget.templateRaw);

    return {
      id: widget._id,
      enabled: widget.enabled,
      html: template.html,
      settings: JSON.parse(widget.settings || '{}'),
      scopes: widget.scopes || [],
      userId: widget.userId,
    };
  }
}
