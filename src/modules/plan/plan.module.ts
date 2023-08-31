import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Plan, PlanSchema } from './models/plan';
import { PlanResolver } from './plan.resolver';
import { PlanService } from './plan.service';
import { MembershipModule } from '../membership/membership.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Plan.name,
        schema: PlanSchema,
      },
    ]),
    MembershipModule,
  ],
  providers: [PlanService, PlanResolver],
  exports: [PlanService],
})
export class PlanModule {}
