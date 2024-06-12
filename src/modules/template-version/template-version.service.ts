import { isSemVerHigh } from '@/utils/versionUtils';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import { AcquisitionService } from '../acquisition/acquisition.service';
import { TemplateDocument } from '../templates/models/template';
import { TemplateService } from '../templates/template.service';
import PostTemplateVersionDTO from './dto/post-template-version.dto';
import {
  TemplateVersion,
  TemplateVersionDocument,
} from './models/template-version';

@Injectable()
export class TemplateVersionService {
  constructor(
    @InjectModel(TemplateVersion.name)
    private readonly versionModel: Model<TemplateVersionDocument>,
    private readonly acquisitionService: AcquisitionService,
    private readonly templateService: TemplateService,
  ) {}

  public async canAccess(templateId: string, profileId: string) {
    const template = await this.templateService.getTemplateById(templateId);
    if (template.creatorId == profileId) {
      return true;
    }

    const isAcquired = await this.acquisitionService.isAcquired(
      profileId,
      templateId,
    );

    return isAcquired;
  }

  public async ensureCanAccess(templateId: string, profileId: string) {
    const canAccess = await this.canAccess(templateId, profileId);
    if (!canAccess) {
      throw new ForbiddenException('You do not have access to this template');
    }
  }

  public async getTemplateVersion(
    templateId: string,
    versionId: string,
  ): Promise<TemplateVersion | null> {
    if (!isValidObjectId(versionId)) {
      return null;
    }

    return await this.versionModel.findOne({
      templateId,
      _id: versionId,
    });
  }

  public async postTemplateVersion(
    profileId: string,
    templateId: string,
    payload: PostTemplateVersionDTO,
  ) {
    const template = await this.templateService.getTemplateById(templateId);
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
    const templateDocument = template as TemplateDocument;
    templateDocument.lastVersion = newVersion;
    templateDocument.lastVersionId = version._id;
    await templateDocument.save();
    return version;
  }
}
