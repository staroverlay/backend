import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { validateJSONSettings } from 'src/utils/fieldValidation';
import { randomString } from 'src/utils/random';

import CreateWidgetDTO from './dto/create-widget.dto';
import { Widget } from './models/widget';
import SettingsField from '../shared/SettingsField';
import { TemplateService } from '../templates/template.service';

@Injectable()
export class WidgetsService {
  constructor(
    @InjectModel(Widget.name)
    private readonly widgetModel: Model<Widget>,

    private readonly templateService: TemplateService,
  ) {}

  public async getWidgetsByUser(userId: string): Promise<Widget[]> {
    return this.widgetModel.find({ userId }).exec();
  }

  public async getWidgetById(id: string): Promise<Widget | null> {
    return this.widgetModel.findById(id).exec();
  }

  public async getWidgetByToken(token: string): Promise<Widget | null> {
    return this.widgetModel.findOne({ token }).exec();
  }

  public async createWidget(
    userId: string,
    payload: CreateWidgetDTO,
  ): Promise<Widget> {
    const template = await this.templateService.getTemplateById(
      payload.template,
    );

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    const fields = JSON.parse(template.fields || '[]') as SettingsField[];
    const settings = JSON.parse(payload.settings || '{}');
    const sanitized = validateJSONSettings(fields, settings);
    payload.settings = JSON.stringify(sanitized);

    const widget = new this.widgetModel({
      userId,
      enabled: true,
      displayName: payload.displayName || template.name,
      settings: payload.settings,
      template: template._id,
      html: template.html,
      scopes: template.scopes,
      token: randomString(24),
    });

    return widget.save();
  }
}
