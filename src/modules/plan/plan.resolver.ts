import { Args, Query, Resolver } from '@nestjs/graphql';

import { Plan } from './models/plan';
import { PlanService } from './plan.service';

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
}
