import { BadRequestException, UseGuards } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';

import { GqlAuthGuard } from '@/src/auth/guards/gql-auth.guard';
import CurrentUser from '@/src/decorators/current-user.decorator';

import { PlanService } from '../plan/plan.service';
import { User } from '../users/models/user';
import Payment from './interfaces/payment';
import { PaymentsService } from './payments.service';

@Resolver(() => Payment)
export class PaymentsResolver {
  constructor(
    private readonly paymentService: PaymentsService,
    private readonly planService: PlanService,
  ) {}

  @Mutation(() => Payment)
  @UseGuards(GqlAuthGuard)
  async createPayment(
    @CurrentUser() user: User,
    @Args('planId') planId: string,
  ): Promise<Payment> {
    const plan = await this.planService.getPlanById(planId);
    if (!plan) throw new BadRequestException('Plan not found.');
    return await this.paymentService.createPayment(user._id, plan);
  }
}
