import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';

import { isSemVerHigh } from '@/src/utils/versionUtils';

import { MediaService } from '../media/media.service';
import { User } from '../users/models/user';
import CreateTemplateDTO from './dto/create-template.dto';
import PostTemplateVersionDTO from './dto/post-template-version.dto';
import UpdateTemplateDTO from './dto/update-template.dto';
import { Template, TemplateDocument } from './models/template';
import {
  TemplateVersion,
  TemplateVersionDocument,
} from './models/template-version';

@Injectable()
export class TemplateService {
  constructor(
    @InjectModel(Template.name)
    private readonly templateModel: Model<TemplateDocument>,
    @InjectModel(TemplateVersion.name)
    private readonly versionModel: Model<TemplateVersionDocument>,
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
      return null;
    }

    return await this.templateModel.find({ creatorId }).exec();
  }

  public async getTemplateById(id: string): Promise<Template | null> {
    if (!isValidObjectId(id)) {
      return null;
    }

    return await this.templateModel.findById(id).exec();
  }

  public async getVersion(versionId: string): Promise<TemplateVersion | null> {
    if (!isValidObjectId(versionId)) {
      return null;
    }

    return await this.versionModel.findById(versionId);
  }

  public async postTemplateVersion(
    profileId: string,
    templateId: string,
    payload: PostTemplateVersionDTO,
  ) {
    const template = (await this.getTemplateById(
      templateId,
    )) as TemplateDocument;

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    if (template.creatorId != profileId) {
      throw new ForbiddenException('You are not the author of this template');
    }

    const lastVersion = template.lastVersion;
    const newVersion = payload.version;

    if (lastVersion && !isSemVerHigh(lastVersion, newVersion)) {
      throw new BadRequestException(
        'Update version must be higher than current version',
      );
    }

    const version = new this.versionModel({
      ...payload,
      templateId: template._id,
    });

    await version.save();
    template.lastVersion = newVersion;
    template.lastVersionId = version._id;
    await template.save();
    return version;
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
