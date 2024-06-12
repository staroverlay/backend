import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';

import { randomName } from '@/utils/randomUtils';

import { Integration } from '../integration/models/integration';
import { User } from '../users/models/user';
import { Profile, ProfileDocument } from './models/profile';

@Injectable()
export class ProfileService {
  constructor(
    @InjectModel(Profile.name)
    private readonly profileModel: Model<ProfileDocument>,
  ) {}

  public async createProfile(user: User): Promise<Profile> {
    const alreadyExists = await this.getByUserID(user._id);
    if (alreadyExists) {
      throw new BadRequestException('User already has a profile.');
    }

    const profile = new this.profileModel({
      userId: user._id,
      displayName: randomName(),
    });

    await profile.save();
    return profile;
  }

  public getByID(id: string): Promise<Profile | null> {
    if (!isValidObjectId(id)) return null;

    return this.profileModel.findById(id).exec();
  }

  public getByUserID(userId: string): Promise<Profile | null> {
    if (!isValidObjectId(userId)) return null;
    return this.profileModel.findOne({ userId }).exec();
  }

  public async updateProfile(
    id: string,
    payload: Partial<Profile>,
  ): Promise<Profile> {
    if (!id || !isValidObjectId(id)) {
      throw new NotFoundException('Profile not found.');
    }

    const profile = await this.profileModel
      .findOneAndUpdate({ _id: id }, { $set: payload }, { new: true })
      .exec();

    if (!profile) {
      throw new NotFoundException('Profile not found.');
    }

    return profile;
  }

  public async updateProfileWithIntegration(
    id: string,
    integration: Integration,
  ) {
    if (!isValidObjectId(id)) {
      throw new NotFoundException('Profile not found.');
    }

    const update = {
      avatar: integration.avatar,
      displayName: integration.username,
    };

    const profile = await this.profileModel
      .findOneAndUpdate({ _id: id }, { $set: update }, { new: true })
      .exec();

    if (!profile) {
      throw new NotFoundException('Profile not found.');
    }

    return profile;
  }
}
