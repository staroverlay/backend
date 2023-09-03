import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

import { GqlAuthGuard } from 'src/auth/guards/gql-auth.guard';
import { IsVerifiedGuard } from 'src/auth/guards/is-verified.guard';
import CurrentUser from 'src/decorators/current-user.decorator';

import { IntegrationService } from './integration.service';
import { Integration } from './models/integration';
import { User } from '../users/models/user';

@Resolver(() => Integration)
export class IntegrationResolver {
  constructor(private integrationService: IntegrationService) {}

  @Query(() => [Integration])
  @UseGuards(GqlAuthGuard)
  async getUserIntegrations(@CurrentUser() user: User) {
    return await this.integrationService.getByOwnerId(user._id);
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
