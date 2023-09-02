import {
  ForbiddenException,
  InternalServerErrorException,
  UseGuards,
} from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { TwitchAPI } from 'twitch-api-ts';

import { GqlAuthGuard } from 'src/auth/guards/gql-auth.guard';
import CurrentUser from 'src/decorators/current-user.decorator';

import CreateTwitchCustomRewardDTO from './dto/CreateTwitchCustomRewardDTO';
import { CustomRewardObject } from './objects/CustomRewardObject';
import { IntegrationService } from '../integration/integration.service';
import { User } from '../users/models/user';

@Resolver(() => CustomRewardObject)
export class TwitchResolver {
  constructor(private integrationService: IntegrationService) {}

  private async createTwitchService(user: User): Promise<TwitchAPI> {
    const integration = await this.integrationService.getByOwnerIdAndType(
      user._id,
      'twitch',
    );

    if (!integration) {
      throw new ForbiddenException(
        "You don't have any Twitch integration linked to your account.",
      );
    }

    return new TwitchAPI({
      accessToken: integration.accessToken,
      clientId: process.env.TWITCH_CLIENT_ID,
      userId: integration.integrationId,
    });
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => CustomRewardObject)
  public async createTwitchCustomReward(
    @CurrentUser() user: User,
    @Args('payload') payload: CreateTwitchCustomRewardDTO,
  ) {
    const service = await this.createTwitchService(user);
    return await service.channelpoints.createCustomReward(payload);
  }

  @UseGuards(GqlAuthGuard)
  @Query(() => [CustomRewardObject])
  public async getTwitchCustomRewards(@CurrentUser() user: User) {
    const service = await this.createTwitchService(user);
    return await service.channelpoints.getCustomRewards().catch((e) => {
      console.error(e);
      throw new InternalServerErrorException(
        process.env['NODE_ENV'] == 'development'
          ? e.message
          : 'Internal server error ocurred.',
      );
    });
  }
}
