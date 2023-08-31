import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import CreateTemplateDTO from './dto/create-template.dto';
import UpdateTemplateDTO from './dto/update-template.dto';
import { Template, TemplateDocument } from './models/template';

@Injectable()
export class TemplateService {
  constructor(
    @InjectModel(Template.name)
    private readonly templateModel: Model<TemplateDocument>,
  ) {}

  public async createTemplate(
    authorId: string,
    payload: CreateTemplateDTO,
  ): Promise<Template> {
    const template = new this.templateModel({
      author: authorId,
      ...payload,
    });
    await template.save();
    return template;
  }

  public async deleteTemplate(authorId: string, id: string): Promise<boolean> {
    const result = await this.templateModel
      .deleteOne({
        _id: id,
        author: authorId,
      })
      .exec();
    return result.deletedCount > 0;
  }

  public async updateTemplate(
    authorId: string,
    id: string,
    payload: UpdateTemplateDTO,
  ): Promise<Template> {
    const { fields, ...data } = payload;
    const newPayload = { ...data, fields: JSON.stringify(fields) };

    return await this.templateModel
      .findOneAndUpdate(
        { _id: id, author: authorId },
        { $set: newPayload },
        { new: true },
      )
      .exec();
  }

  public async getTemplatesByAuthor(authorId: string): Promise<Template[]> {
    return await this.templateModel.find({ author: authorId }).exec();
  }

  public async getTemplateById(id: string): Promise<Template | null> {
    return await this.templateModel.findById(id).exec();
  }
}
