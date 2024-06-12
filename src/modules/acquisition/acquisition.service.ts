import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { TemplateService } from '@/modules/templates/template.service';

import CreateAcquisitionDTO from './dto/create-acquisition.dto';
import { Acquisition, AcquisitionDocument } from './models/acquisition';

@Injectable()
export class AcquisitionService {
  constructor(
    @InjectModel(Acquisition.name)
    private readonly acquisitionModel: Model<AcquisitionDocument>,

    private readonly templateService: TemplateService,
  ) {}

  public async isAcquired(profileId: string, productId: string) {
    return await this.acquisitionModel.exists({ profileId, productId });
  }

  public async getAcquisitions(profileId: string) {
    return this.acquisitionModel.find({ profileId }).exec();
  }

  public async createAcquisition(
    buyerProfileId: string,
    profileId: string,
    dto: CreateAcquisitionDTO,
  ) {
    const { productId, productType } = dto;
    const template = await this.templateService.getTemplateById(dto.productId);

    if (!template) {
      throw new NotFoundException(
        'Template with ID ' + productId + " doesn't exist.",
      );
    }

    if (template.creatorId != profileId) {
      // Check visibility.
      if (template.visibility == 'private') {
        throw new ForbiddenException(
          'You do not have permissions to acquire this product.',
        );
      }

      // Check price. (Todo: Rework this)
      if ((template.price || 0) > 0) {
        throw new BadRequestException(
          "This product isn't free and payments are not implemented yet.",
        );
      }
    }

    const acquisition = new this.acquisitionModel({
      profileId,
      productId,
      productType,
      isGift: false,
    });

    if (buyerProfileId != profileId) {
      acquisition.isGift = true;
      acquisition.gifterProfileId = buyerProfileId;
    }

    await acquisition.save();
    return acquisition;
  }
}
