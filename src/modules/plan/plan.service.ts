import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Plan, PlanDocument } from './models/plan';

@Injectable()
export class PlanService {
  constructor(
    @InjectModel(Plan.name)
    private readonly planModel: Model<PlanDocument>,
  ) {}

  public async getPlanById(id: string): Promise<Plan> {
    return this.planModel.findById(id).exec();
  }

  public async getDefaultPlan(): Promise<Plan> {
    return this.planModel.findOne({ isDefault: true }).exec();
  }

  public async getPlans(): Promise<Plan[]> {
    return this.planModel.find().exec();
  }
}
