import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { UsersService } from '../users/users.service';
import CreateTemplateDTO from './dto/create-template.dto';
import UpdateTemplateDTO from './dto/update-template.dto';
import { Template, TemplateDocument } from './models/template';

const DEFAULT_FIELDS = [
  {
    id: '',
    label: '',
    children: [],
  },
];

const DEFAULT_FIELDS_STR = JSON.stringify(DEFAULT_FIELDS);

@Injectable()
export class TemplateService {
  constructor(
    @InjectModel(Template.name)
    private readonly templateModel: Model<TemplateDocument>,
    private readonly usersService: UsersService,
  ) {}

  async fixTemplate(template: TemplateDocument | null) {
    if (!template) return null;

    if (!template.author) {
      const author = await this.usersService.getByID(template.authorId);
      template.author = {
        id: author._id,
        username: author.username,
        avatar: author.avatar,
      };
    }

    return template;
  }

  public async createTemplate(
    authorId: string,
    payload: CreateTemplateDTO,
  ): Promise<Template> {
    const template = new this.templateModel({
      author: authorId,
      service: 'twitch',
      fields: DEFAULT_FIELDS_STR,
      ...payload,
    });
    await template.save();
    return await this.fixTemplate(template);
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

    const template = await this.templateModel
      .findOneAndUpdate(
        { _id: id, author: authorId },
        { $set: newPayload },
        { new: true },
      )
      .exec();
    return await this.fixTemplate(template);
  }

  public async getTemplatesByAuthor(authorId: string): Promise<Template[]> {
    const templates = await this.templateModel.find({ authorId }).exec();
    return await Promise.all(templates.map((t) => this.fixTemplate(t)));
  }

  public async getTemplateById(id: string): Promise<Template | null> {
    const template = await this.templateModel.findById(id).exec();
    return await this.fixTemplate(template);
  }
}
