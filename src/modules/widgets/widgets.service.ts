import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';

import { validateJSONSettingsGroup } from '@/src/utils/fieldValidationUtils';
import { randomString } from '@/src/utils/randomUtils';

import { SettingsFieldGroup } from '../shared/SettingsFieldGroup';
import { Template } from '../templates/models/template';
import { TemplateService } from '../templates/template.service';
import CreateWidgetDTO from './dto/create-widget.dto';
import UpdateWidgetDTO from './dto/update-widget-dto';
import { Widget } from './models/widget';

function sanitizeTemplate(template: Template) {
  return {
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
  };
}

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
      templateRaw: JSON.stringify(sanitizeTemplate(template)),
      token: randomString(24),
      scopes: template.scopes || [],
      service: template.service,
      autoUpdate: false,
    });

    return widget.save();
  }

  async fixWidget(widget: Widget): Promise<Widget> {
    if (widget.autoUpdate) {
      const template = await this.templateService.getTemplateById(
        widget.templateId,
      );
      widget.templateRaw = JSON.stringify(sanitizeTemplate(template));
    }

    return widget;
  }

  public async getWidgetsByUser(userId: string): Promise<Widget[]> {
    const widgets = await this.widgetModel.find({ userId }).exec();
    return await Promise.all(widgets.map((w) => this.fixWidget(w)));
  }

  public async getWidgetById(id: string): Promise<Widget | null> {
    const widget = await this.widgetModel.findById(id).exec();
    return await this.fixWidget(widget);
  }

  public async getWidgetByToken(token: string): Promise<Widget | null> {
    const widget = await this.widgetModel.findOne({ token }).exec();
    return await this.fixWidget(widget);
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
    const widgetPayload: Partial<Widget> = { ...payload };

    if (!widget) {
      throw new NotFoundException("Widget with this ID doesn't exist.");
    }

    // If autoUpdate is toggled to true, we clear the templateRaw field.
    if (payload.autoUpdate != widget.autoUpdate && payload.autoUpdate) {
      widgetPayload.templateRaw = null;
      widget.autoUpdate = true;
    }

    let template: Template | null = null;

    // If autoUpdate is toggled on.
    if (widget.autoUpdate) {
      // Fetch the template from the database.
      template = await this.templateService.getTemplateById(widget.templateId);

      // If autoUpdate is toggled from true to false, we save the templateRaw field.
      if (payload.autoUpdate != widget.autoUpdate && !payload.autoUpdate) {
        widgetPayload.templateRaw = JSON.stringify(sanitizeTemplate(template));
      }
    } else {
      // Else, we use the templateRaw field stored in the widget.
      template = JSON.parse(widget.templateRaw) as Template;
    }

    const fields = JSON.parse(template.fields || '[]') as SettingsFieldGroup[];
    const settings = JSON.parse(payload.settings || '{}');
    const sanitized = validateJSONSettingsGroup(fields, settings);
    payload.settings = JSON.stringify(sanitized);

    await widget.update({
      $set: {
        ...widgetPayload,
      },
    });

    return widget;
  }

  public async resetWidgetToken(
    userId: string,
    widgetId: string,
  ): Promise<Widget> {
    const widget = await this.widgetModel.findOne({ userId, _id: widgetId });

    if (!widget) {
      throw new NotFoundException("Widget with this ID doesn't exist.");
    }

    widget.token = randomString(24);
    await widget.save();
    return widget;
  }

  public async deleteWidget(userId: string, widgetId: string) {
    const result = await this.widgetModel.deleteOne({ userId, _id: widgetId });
    return result.deletedCount > 0;
  }
}
