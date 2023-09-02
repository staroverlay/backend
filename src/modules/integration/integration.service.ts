import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Integration, IntegrationType } from './models/integration';

@Injectable()
export class IntegrationService {
  constructor(
    @InjectModel(Integration.name)
    private readonly integrationModel: Model<Integration>,
  ) {}

  public getByID(id: string): Promise<Integration | null> {
    return this.integrationModel.findById(id).exec();
  }

  public getByIntegrationId(
    integrationId: string,
    type: IntegrationType,
  ): Promise<Integration | null> {
    return this.integrationModel.findOne({ integrationId, type }).exec();
  }

  public getByOwnerIdAndType(
    ownerId: string,
    type: IntegrationType,
  ): Promise<Integration | null> {
    return this.integrationModel.findOne({ ownerId, type }).exec();
  }

  public getByOwnerId(ownerId: string): Promise<Integration[]> {
    return this.integrationModel.find({ ownerId }).exec();
  }

  public async createIntegration(
    ownerId: string,
    integrationId: string,
    accessToken: string,
    refreshToken: string,
    username: string,
    avatar: string,
    type: string,
  ): Promise<Integration> {
    const integration = new this.integrationModel({
      ownerId,
      integrationId,
      accessToken,
      refreshToken,
      username,
      avatar,
      type,
    });

    await integration.save();
    return integration;
  }

  public async deleteIntegration(
    ownerId: string,
    id: string,
  ): Promise<boolean> {
    const integration = await this.integrationModel.findOneAndDelete({
      ownerId,
      _id: id,
    });
    if (!integration) return false;
    return true;
  }
}
