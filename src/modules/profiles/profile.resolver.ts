import { NotFoundException, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

import { GqlAuthGuard } from '@/auth/guards/gql-auth.guard';
import { IsVerifiedGuard } from '@/auth/guards/is-verified.guard';
import CurrentUser from '@/decorators/current-user.decorator';

import { IntegrationService } from '../integration/integration.service';
import { User } from '../users/models/user';
import { UpdateProfileDTO } from './dto/update-profile.dto';
import { Profile } from './models/profile';
import { ProfileService } from './profile.service';

@Resolver(() => Profile)
export class ProfileResolver {
  constructor(
    private profileService: ProfileService,
    private integrationService: IntegrationService,
  ) {}

  @Query(() => Profile, { nullable: true })
  async getProfile(@Args('id') id: string) {
    const profile = await this.profileService.getByID(id);
    return profile;
  }

  @Query(() => Profile, { nullable: true })
  @UseGuards(GqlAuthGuard)
  async getMyProfile(@CurrentUser() user: User) {
    return await this.profileService.getByID(user.profileId);
  }

  @Mutation(() => Profile)
  @UseGuards(GqlAuthGuard, IsVerifiedGuard)
  async updateProfile(
    @CurrentUser() user: User,
    @Args('payload') payload: UpdateProfileDTO,
  ) {
    return await this.profileService.updateProfile(user.profileId, payload);
  }

  @Mutation(() => Profile)
  @UseGuards(GqlAuthGuard, IsVerifiedGuard)
  async syncProfileWithIntegration(
    @CurrentUser() user: User,
    @Args('id') integrationId: string,
  ) {
    const integration = await this.integrationService.getByID(integrationId);
    if (!integration || user._id != integration.ownerId) {
      throw new NotFoundException('Integration not found.');
    }

    return await this.profileService.updateProfileWithIntegration(
      user.profileId,
      integration,
    );
  }
}
