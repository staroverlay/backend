import { UseGuards } from '@nestjs/common';
import { Mutation, Resolver } from '@nestjs/graphql';

import { GqlAuthGuard } from 'src/auth/guards/gql-auth.guard';
import CurrentUser from 'src/decorators/current-user.decorator';

import { MembershipService } from './membership.service';
import { Membership } from './models/membership';
import { User } from '../users/models/user';

@Resolver(() => Membership)
export class MembershipResolver {
  constructor(private membershipService: MembershipService) {}

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Membership)
  public async getMyMembership(@CurrentUser() user: User) {
    const membership = await this.membershipService.getMembershipByUserId(
      user.id,
    );
    return membership;
  }
}
