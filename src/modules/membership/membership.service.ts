import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Membership, MembershipDocument } from './models/membership';

@Injectable()
export class MembershipService {
  constructor(
    @InjectModel(Membership.name)
    private readonly membershipModel: Model<MembershipDocument>,
  ) {}

  public async createMembership(
    userId: string,
    planId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Membership> {
    const membership = new this.membershipModel({
      userId,
      planId,
      startDate,
      endDate,
    });
    return membership.save();
  }

  public async deleteMembership(id: string): Promise<Membership> {
    return this.membershipModel.findByIdAndDelete(id).exec();
  }

  public async getMembershipById(id: string): Promise<Membership> {
    return this.membershipModel.findById(id).exec();
  }

  public async getMembershipByUserId(userId: string): Promise<Membership> {
    return this.membershipModel.findOne({ userId }).exec();
  }

  public async getMembershipsCount(): Promise<number> {
    return this.membershipModel.countDocuments().exec();
  }
}
