import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';

import { getFieldPath } from '@/utils/fieldUtils';
import { validateJSONSettingsGroup } from '@/utils/fieldValidationUtils';
import { randomString } from '@/utils/randomUtils';

import { EventEmitter2 } from '@nestjs/event-emitter';
import AppEvents from '../shared/AppEvents';
import SettingsFieldType from '../shared/SettingsFieldType';
import { TemplateVersion } from '../template-version/models/template-version';
import { TemplateVersionService } from '../template-version/template-version.service';
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
    private readonly versionService: TemplateVersionService,
    private eventEmitter: EventEmitter2,
  ) {}

  public async createWidget(
    ownerId: string,
    payload: CreateWidgetDTO,
  ): Promise<Widget> {
    await this.versionService.ensureCanAccess(payload.template, ownerId);

    const template = await this.templateService.getTemplateById(
      payload.template,
    );

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    if (!template.lastVersionId) {
      throw new BadRequestException('Template has no versions');
    }

    const lastVersion = await this.versionService.getTemplateVersion(
      template._id,
      template.lastVersionId,
    );

    const defaultConfig = getDefaultConfig(lastVersion);
    const widget = new this.widgetModel({
      ownerId,
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

  public async getWidgetsByUser(ownerId: string): Promise<Widget[]> {
    const widgets = await this.widgetModel.find({ ownerId }).exec();
    return widgets;
  }

  public async getWidgetById(id: string): Promise<Widget | null> {
    return await this.widgetModel.findById(id).exec();
  }

  public async getWidgetByToken(token: string): Promise<Widget | null> {
    return await this.widgetModel.findOne({ token }).exec();
  }

  public async updateWidget(
    ownerId: string,
    id: string,
    payload: UpdateWidgetDTO,
  ): Promise<Widget> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Invalid widget ID format');
    }

    const widget = (await this.widgetModel.findOne({
      _id: id,
      ownerId,
    })) as WidgetDocument;

    if (!widget) {
      throw new NotFoundException("Widget with this ID doesn't exist.");
    }

    // Fetch last version.
    let lastVersion = null;

    if (widget.autoUpdate) {
      const template = await this.templateService.getTemplateById(
        widget.templateId,
      );
      lastVersion = await this.versionService.getTemplateVersion(
        widget.templateId,
        template.lastVersionId,
      );
    } else {
      lastVersion = await this.versionService.getTemplateVersion(
        widget.templateId,
        widget.templateVersion,
      );
    }

    const settings = JSON.parse(payload.settings || '{}');
    const sanitized = validateJSONSettingsGroup(lastVersion.fields, settings);
    payload.settings = JSON.stringify(sanitized);

    if (widget.settings !== payload.settings) {
      this.eventEmitter.emit(AppEvents.WIDGET_UPDATE, {
        widget,
        settings: payload.settings,
      });
    }

    if (payload.enabled !== undefined && widget.enabled !== payload.enabled) {
      this.eventEmitter.emit(AppEvents.WIDGET_TOGGLE, {
        widget,
        enabled: payload.enabled,
      });
    }

    await widget.updateOne({
      $set: {
        ...payload,
        templateVersion: lastVersion._id,
      },
    });

    return {
      ...widget.toObject(),
      ...payload,
    };
  }

  public async resetWidgetToken(
    ownerId: string,
    widgetId: string,
  ): Promise<Widget> {
    const widget = await this.widgetModel.findOne({
      ownerId,
      _id: widgetId,
    });

    if (!widget) {
      throw new NotFoundException("Widget with this ID doesn't exist.");
    }

    widget.token = randomString(24);
    await widget.save();
    return widget;
  }

  public async deleteWidget(ownerId: string, widgetId: string) {
    const result = await this.widgetModel.deleteOne({ ownerId, _id: widgetId });
    return result.deletedCount > 0;
  }
}
