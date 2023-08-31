import { UseGuards } from '@nestjs/common';
import { Query, Resolver } from '@nestjs/graphql';

import { GqlAuthGuard } from 'src/auth/guards/gql-auth.guard';
import CurrentUser from 'src/decorators/current-user.decorator';

import { MembershipService } from './membership.service';
import { Membership } from './models/membership';
import { User } from '../users/models/user';

@Resolver(() => Membership)
export class MembershipResolver {
  constructor(private membershipService: MembershipService) {}

  @UseGuards(GqlAuthGuard)
  @Query(() => Membership, { nullable: true })
  public async getMyMembership(@CurrentUser() user: User) {
    const membership = await this.membershipService.getMembershipByUserId(
      user._id,
    );
    return membership;
  }
}
