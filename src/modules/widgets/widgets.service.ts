import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';

import { getFieldPath } from '@/src/utils/fieldUtils';
import { validateJSONSettingsGroup } from '@/src/utils/fieldValidationUtils';
import { randomString } from '@/src/utils/randomUtils';

import SettingsFieldType from '../shared/SettingsFieldType';
import { TemplateVersion } from '../templates/models/template-version';
import { TemplateService } from '../templates/template.service';
import CreateWidgetDTO from './dto/create-widget.dto';
import UpdateWidgetDTO from './dto/update-widget-dto';
import { Widget, WidgetDocument } from './models/widget';

function defaultValueFromType(type: SettingsFieldType) {
  switch (type) {
    case 'string':
      return '';
    case 'number':
      return 0;
    case 'boolean':
      return false;
    case 'map':
      return {};
    case 'array':
      return [];
    case 'enum':
      return '';
    default:
      return null;
  }
}

function getDefaultConfig(version: TemplateVersion) {
  const fields = version.fields;
  const config: Record<string, any> = {};

  fields.forEach((field) => {
    field.children.forEach((child) => {
      const id = getFieldPath(field, child);
      const value = child[child.type]?.default;
      const hasValue = value != null && value !== undefined;
      config[id] = hasValue ? value : defaultValueFromType(child.type);
    });
  });

  return config;
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

    if (!template.lastVersionId) {
      throw new BadRequestException('Template has no versions');
    }

    const lastVersion = await this.templateService.getVersion(
      template.lastVersionId,
    );

    const defaultConfig = getDefaultConfig(lastVersion);
    const widget = new this.widgetModel({
      userId,
      enabled: false,
      displayName: payload.displayName || template.name,
      settings: JSON.stringify(defaultConfig),
      templateId: template._id,
      templateVersion: lastVersion._id,
      token: randomString(24),
      scopes: lastVersion.scopes || [],
      service: template.service,
      autoUpdate: false,
    });

    await widget.save();
    return widget;
  }

  public async getWidgetsByUser(userId: string): Promise<Widget[]> {
    const widgets = await this.widgetModel.find({ userId }).exec();
    return widgets;
  }

  public async getWidgetById(id: string): Promise<Widget | null> {
    return await this.widgetModel.findById(id).exec();
  }

  public async getWidgetByToken(token: string): Promise<Widget | null> {
    return await this.widgetModel.findOne({ token }).exec();
  }

  public async updateWidget(
    userId: string,
    id: string,
    payload: UpdateWidgetDTO,
  ): Promise<Widget> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Invalid widget ID format');
    }

    const widget = (await this.widgetModel.findOne({
      _id: id,
      userId,
    })) as WidgetDocument;

    if (!widget) {
      throw new NotFoundException("Widget with this ID doesn't exist.");
    }

    // If autoUpdate is toggled to true, we clear the templateVersion field.
    if (payload.autoUpdate != widget.autoUpdate) {
      if (payload.autoUpdate) {
        widget.templateVersion = null;
      } else {
        const template = await this.templateService.getTemplateById(
          widget.templateId,
        );
        widget.templateVersion = template.lastVersionId;
      }
    }

    // Fetch last version.
    let lastVersion = null;

    if (widget.templateVersion) {
      lastVersion = await this.templateService.getVersion(
        widget.templateVersion,
      );
    } else {
      const template = await this.templateService.getTemplateById(
        widget.templateId,
      );
      lastVersion = await this.templateService.getVersion(
        template.lastVersionId,
      );
    }

    const settings = JSON.parse(payload.settings || '{}');
    const sanitized = validateJSONSettingsGroup(lastVersion.fields, settings);
    payload.settings = JSON.stringify(sanitized);

    await widget.updateOne({
      $set: {
        ...payload,
      },
    });

    return {
      ...widget.toObject(),
      ...payload,
    };
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
