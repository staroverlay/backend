import { GqlAuthGuard } from '@/auth/guards/gql-auth.guard';
import { IsVerifiedGuard } from '@/auth/guards/is-verified.guard';
import CurrentUser from '@/decorators/current-user.decorator';
import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { User } from '../users/models/user';
import { AcquisitionService } from './acquisition.service';
import CreateAcquisitionDTO from './dto/create-acquisition.dto';
import { Acquisition } from './models/acquisition';

@Resolver(() => Acquisition)
export class AcquisitionResolver {
  constructor(private readonly acquisitionService: AcquisitionService) {}

  @Mutation(() => Acquisition)
  @UseGuards(GqlAuthGuard, IsVerifiedGuard)
  async createAcquisition(
    @CurrentUser() user: User,
    @Args('payload') payload: CreateAcquisitionDTO,
  ) {
    return this.acquisitionService.createAcquisition(
      user.profileId,
      user.profileId,
      payload,
    );
  }

  @Query(() => [Acquisition])
  @UseGuards(GqlAuthGuard, IsVerifiedGuard)
  async getAcquisitions(@CurrentUser() user: User) {
    return this.acquisitionService.getAcquisitions(user.profileId);
  }
}
