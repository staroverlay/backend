import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Plan, PlanSchema } from './models/plan';
import { PlanService } from './plan.service';
import { PlanResolver } from './plan.resolver';

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
