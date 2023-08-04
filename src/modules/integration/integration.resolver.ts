import { BadRequestException, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

import { GqlAuthGuard } from 'src/auth/guards/gql-auth.guard';
import { IsVerifiedGuard } from 'src/auth/guards/is-verified.guard';
import CurrentUser from 'src/decorators/current-user.decorator';

import { IntegrationService } from './integration.service';
import { Integration } from './models/integration';
import { TwitchService } from '../twitch/twitch.service';
import { User } from '../users/models/user';

@Resolver(() => Integration)
export class IntegrationResolver {
  constructor(
    private integrationService: IntegrationService,
    private twitchService: TwitchService,
  ) {}

  @Query(() => [Integration])
  @UseGuards(GqlAuthGuard)
  async getUserIntegrations(@CurrentUser() user: User) {
    return await this.integrationService.getByOwnerId(user._id);
  }

  @Mutation(() => Integration)
  @UseGuards(GqlAuthGuard, IsVerifiedGuard)
  async createTwitchIntegration(
    @CurrentUser() user: User,
    @Args('code') code: string,
  ) {
    const existent = await this.integrationService.getByOwnerIdAndType(
      user._id,
      'twitch',
    );

    if (existent != null) {
      throw new BadRequestException('You already have a Twitch integration.');
    }

    const tokens = await this.twitchService.verifyCode(code);
    const twitchUser = await this.twitchService.getUserData(
      tokens.access_token,
    );

    return await this.integrationService.createIntegration(
      user._id,
      twitchUser.id,
      tokens.access_token,
      tokens.refresh_token,
      twitchUser.login,
      twitchUser.profile_image_url,
      'twitch',
    );
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard, IsVerifiedGuard)
  public async removeIntegration(
    @CurrentUser() user: User,
    @Args('id') integration: string,
  ) {
    return await this.integrationService.deleteIntegration(
      user._id,
      integration,
    );
  }
}
