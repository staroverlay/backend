import { BadRequestException, UseGuards } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';

import { GqlAuthGuard } from 'src/auth/guards/gql-auth.guard';
import { IsVerifiedGuard } from 'src/auth/guards/is-verified.guard';
import CurrentUser from 'src/decorators/current-user.decorator';

import { IntegrationService } from '../integration/integration.service';
import { Integration } from '../integration/models/integration';
import { TwitchService } from '../twitch/twitch.service';
import { User } from '../users/models/user';

@Resolver(() => Integration)
export class OAuthResolver {
  constructor(
    private readonly integrationService: IntegrationService,
    private readonly twitchService: TwitchService,
  ) {}

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
      Date.now() + tokens.expires_in * 1000,
    );
  }
}
