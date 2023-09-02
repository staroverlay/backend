import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';

import { validateJSONSettings } from 'src/utils/fieldValidation';
import { randomString } from 'src/utils/random';

import CreateWidgetDTO from './dto/create-widget.dto';
import UpdateWidgetDTO from './dto/update-widget-dto';
import { Widget } from './models/widget';
import SettingsField from '../shared/SettingsField';
import { Template } from '../templates/models/template';
import { TemplateService } from '../templates/template.service';

@Injectable()
export class WidgetsService {
  constructor(
    @InjectModel(Widget.name)
    private readonly widgetModel: Model<Widget>,

    private readonly templateService: TemplateService,
  ) {}

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

    const widget = new this.widgetModel({
      userId,
      enabled: false,
      displayName: payload.displayName || template.name,
      settings: '{}',
      templateId: template._id,
      templateRaw: JSON.stringify({
        _id: template._id,
        author: template.author,
        html: template.html,
        name: template.name,
        version: template.version,
        visibility: template.visibility,
        description: template.description,
        scopes: template.scopes,
        service: template.service,
        fields: template.fields,
      }),
      token: randomString(24),
      scopes: template.scopes || [],
    });

    return widget.save();
  }

  public async getWidgetsByUser(userId: string): Promise<Widget[]> {
    return this.widgetModel.find({ userId }).exec();
  }

  public async getWidgetById(id: string): Promise<Widget | null> {
    return this.widgetModel.findById(id).exec();
  }

  public async getWidgetByToken(token: string): Promise<Widget | null> {
    return this.widgetModel.findOne({ token }).exec();
  }

  public async updateWidget(
    userId: string,
    id: string,
    payload: UpdateWidgetDTO,
  ): Promise<Widget> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Invalid widget ID format');
    }

    const widget = await this.widgetModel.findOne({ _id: id, userId }).exec();

    if (!widget) {
      throw new NotFoundException("Widget with this ID doesn't exist.");
    }

    const template = JSON.parse(widget.templateRaw) as Template;
    const fields = JSON.parse(template.fields || '[]') as SettingsField[];
    const settings = JSON.parse(payload.settings || '{}');
    const sanitized = validateJSONSettings(fields, settings);
    payload.settings = JSON.stringify(sanitized);

    await widget.update({
      $set: payload,
    });

    return widget;
  }

  public async deleteWidget(userId: string, widgetId: string) {
    const result = await this.widgetModel.deleteOne({ userId, _id: widgetId });
    return result.deletedCount > 0;
  }
}
