import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TwitchOAuthResponse } from 'twitch-oauth';

import { asyncMap } from '@/utils/asyncUtils';
import twitchAuth from '@/utils/twitchAuth';

import {
  Integration,
  IntegrationDocument,
  IntegrationType,
} from './models/integration';

@Injectable()
export class IntegrationService {
  constructor(
    @InjectModel(Integration.name)
    private readonly integrationModel: Model<Integration>,
  ) {
    this.refreshIntegration = this.refreshIntegration.bind(this);
  }

  public async createIntegration(
    ownerId: string,
    integrationId: string,
    accessToken: string,
    refreshToken: string,
    username: string,
    avatar: string,
    type: string,
    expires: number,
  ): Promise<Integration> {
    const integration = new this.integrationModel({
      ownerId,
      integrationId,
      accessToken,
      refreshToken,
      username,
      avatar,
      type,
      expires,
    });

    await integration.save();
    return integration;
  }

  async refreshTwitch(integration: IntegrationDocument) {
    const refresh: TwitchOAuthResponse | null = await twitchAuth
      .refresh(integration.refreshToken)
      .catch(() => {
        integration.delete().exec();
        return null;
      });

    if (refresh) {
      integration.accessToken = refresh.access_token;
      integration.expires = Date.now() + refresh.expires_in * 1000;
      await integration.save();
      return integration;
    }

    return null;
  }

  async refreshIntegration(
    integration: IntegrationDocument | null | undefined,
  ) {
    const isExpired =
      integration &&
      (integration.expires === undefined || integration.expires < Date.now());

    if (isExpired) {
      switch (integration.type) {
        case 'twitch': {
          return await this.refreshTwitch(integration);
        }
      }
    }

    return integration;
  }

  public async getByID(id: string): Promise<Integration | null> {
    const integration = await this.integrationModel.findById(id).exec();
    return await this.refreshIntegration(integration);
  }

  public async getByIntegrationId(
    integrationId: string,
    type: IntegrationType,
  ): Promise<Integration | null> {
    const integration = await this.integrationModel
      .findOne({ integrationId, type })
      .exec();
    return await this.refreshIntegration(integration);
  }

  public async getByOwnerIdAndType(
    ownerId: string,
    type: IntegrationType,
  ): Promise<Integration | null> {
    const integration = await this.integrationModel
      .findOne({ ownerId, type })
      .exec();
    return await this.refreshIntegration(integration);
  }

  public async getByOwnerId(ownerId: string): Promise<Integration[]> {
    const integrations = await this.integrationModel.find({ ownerId }).exec();
    return await asyncMap(integrations, this.refreshIntegration);
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
