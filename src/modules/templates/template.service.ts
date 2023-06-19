import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Template, TemplateDocument } from './models/template';

@Injectable()
export class TemplateService {
  constructor(
    @InjectModel(Template.name)
    private readonly templateModel: Model<TemplateDocument>,
  ) {}

  public async createTemplate(
    authorId: string,
    name: string,
    description: string,
    scopes: string[],
    service: string,
    html: string,
    settings: string,
  ): Promise<Template> {
    const template = new this.templateModel({
      author: authorId,
      name,
      description,
      scopes,
      service,
      html,
      settings,
    });
    await template.save();
    return template;
  }

  public async getTemplatesByAuthor(authorId: string): Promise<Template[]> {
    return await this.templateModel.find({ author: authorId }).exec();
  }

  public async getTemplateById(id: string): Promise<Template | null> {
    return await this.templateModel.findById(id).exec();
  }
}