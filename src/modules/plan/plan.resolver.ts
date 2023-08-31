import { UseGuards } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';

import { GqlAuthGuard } from 'src/auth/guards/gql-auth.guard';
import CurrentUser from 'src/decorators/current-user.decorator';

import { Plan } from './models/plan';
import { PlanService } from './plan.service';
import { User } from '../users/models/user';

@Resolver(() => Plan)
export class PlanResolver {
  constructor(private readonly planService: PlanService) {}

  @Query(() => [Plan])
  public async getPlans() {
    return await this.planService.getPlans();
  }

  @Query(() => Plan)
  public async getPlanById(@Args('id') id: string) {
    return await this.planService.getPlanById(id);
  }

  @Query(() => Plan)
  public async getDefaultPlan() {
    return await this.planService.getDefaultPlan();
  }

  @Query(() => Plan)
  @UseGuards(GqlAuthGuard)
  public async getCurrentPlan(@CurrentUser() user: User) {
    return await this.planService.getActivePlan(user._id);
  }
}
