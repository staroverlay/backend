import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import CreateWidgetDTO from './dto/create-widget.dto';
import { Widget } from './models/widget';

@Injectable()
export class WidgetsService {
  constructor(
    @InjectModel(Widget.name)
    private readonly widgetModel: Model<Widget>,
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
    const widget = new this.widgetModel({
      ...payload,
      userId,
    });

    return widget.save();
  }
}
