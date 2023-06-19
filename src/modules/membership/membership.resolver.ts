import { Mutation, Resolver } from '@nestjs/graphql';
import { Membership } from './models/membership';
import { MembershipService } from './membership.service';
import CurrentUser from 'src/decorators/current-user.decorator';
import { User } from '../users/models/user';
import { UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from 'src/auth/guards/gql-auth.guard';

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
