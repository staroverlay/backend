import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';

import { MediaService } from '../media/media.service';
import { User } from '../users/models/user';
import CreateTemplateDTO from './dto/create-template.dto';
import UpdateTemplateDTO from './dto/update-template.dto';
import { Template, TemplateDocument } from './models/template';

@Injectable()
export class TemplateService {
  constructor(
    @InjectModel(Template.name)
    private readonly templateModel: Model<TemplateDocument>,
    private readonly mediaService: MediaService,
  ) {}

  public async createTemplate(
    author: User,
    payload: CreateTemplateDTO,
  ): Promise<Template> {
    if (!author.profileId) {
      throw new UnauthorizedException(
        'You must have a profile to create a template',
      );
    }

    const template = new this.templateModel({
      creatorUserId: author._id,
      creatorId: author.profileId,
      ...payload,
    });
    await template.save();
    return template;
  }

  public async getTemplatesByCreator(creatorId: string): Promise<Template[]> {
    if (!isValidObjectId(creatorId)) {
      return [];
    }

    return await this.templateModel.find({ creatorId }).exec();
  }

  public async getTemplateById(id: string): Promise<Template | null> {
    if (!isValidObjectId(id)) {
      return null;
    }

    return await this.templateModel.findById(id).exec();
  }

  public async updateTemplate(
    userId: string,
    id: string,
    payload: UpdateTemplateDTO,
  ): Promise<Template> {
    if (!isValidObjectId(id)) {
      throw new NotFoundException('Template not found');
    }

    const template = await this.templateModel.findById(id).exec();
    if (!template) {
      throw new NotFoundException('Template not found');
    }

    if (
      payload.visibility &&
      payload.visibility != 'private' &&
      !template.lastVersion
    ) {
      throw new BadRequestException(
        'You cannot set a template to public without a version',
      );
    }

    if (payload.thumbnail) {
      const thumbnail = await this.mediaService.getMediaByID(payload.thumbnail);
      if (
        !thumbnail ||
        thumbnail.type != 'image' ||
        thumbnail.userId != userId
      ) {
        throw new BadRequestException('Invalid thumbnail');
      }
    }

    Object.assign(template, payload);
    await template.save();
    return template;
  }

  public async deleteTemplate(userId: string, id: string): Promise<boolean> {
    const result = await this.templateModel.deleteOne({
      _id: id,
      creatorUserId: userId,
    });

    return result.deletedCount > 0;
  }
}
