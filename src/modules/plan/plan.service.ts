import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import CreatePlanDTO from './dto/create-plan.dto';
import { Plan, PlanDocument } from './models/plan';
import { MembershipService } from '../membership/membership.service';

@Injectable()
export class PlanService {
  constructor(
    @InjectModel(Plan.name)
    private readonly planModel: Model<PlanDocument>,
    private readonly memberships: MembershipService,
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

  public async getActivePlan(userId: string): Promise<Plan> {
    const membership = await this.memberships.getMembershipByUserId(userId);
    if (membership) {
      return await this.getPlanById(membership.planId);
    } else {
      return await this.getDefaultPlan();
    }
  }

  public async createPlan(payload: CreatePlanDTO): Promise<Plan> {
    const plan = new this.planModel(payload);
    await plan.save();
    return plan;
  }
}
