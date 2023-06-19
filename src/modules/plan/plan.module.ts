import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Plan, PlanSchema } from './models/plan';
import { PlanResolver } from './plan.resolver';
import { PlanService } from './plan.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Plan.name,
        schema: PlanSchema,
      },
    ]),
  ],
  providers: [PlanService, PlanResolver],
  exports: [PlanService],
})
export class PlanModule {}
