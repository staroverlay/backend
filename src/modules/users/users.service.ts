import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';

import { randomString } from '@/src/utils/randomUtils';

import { EmailService } from '../email/email.service';
import { ProfileService } from '../profiles/profile.service';
import { CreateUserDTO } from './dto/create-user.dto';
import { User, UserDocument } from './models/user';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly profileService: ProfileService,
    private readonly emailService: EmailService,
  ) {}

  public getByID(id: string): Promise<User | null> {
    if (!isValidObjectId(id)) return null;

    return this.userModel.findById(id).exec();
  }

  public getByEmail(email: string): Promise<User | null> {
    return this.userModel.findOne({ email }).exec();
  }

  public async requireEmailVerificationFor(user: UserDocument) {
    if (user.isEmailVerified) {
      throw new BadRequestException('Email already verified.');
    }

    if (!user.emailVerificationCode) {
      user.isEmailVerified = false;
      user.emailVerificationCode = randomString(6);
      await this.emailService.sendEmail(
        'accounts',
        user.email,
        'Email Verification',
        `Your verification code is: ${user.emailVerificationCode}`,
      );
    }
  }

  public async createUser(
    { email, password }: CreateUserDTO,
    emailVerified = false,
  ) {
    const existent = await this.getByEmail(email);

    if (existent) {
      throw new BadRequestException('User with this email already exists.');
    }

    const user = new this.userModel({
      email,
      password,
    });

    if (emailVerified) {
      const profile = await this.profileService.createProfile(user);
      user.profileId = profile._id;
      user.isEmailVerified = true;
      user.emailVerificationCode = null;
    } else {
      this.requireEmailVerificationFor(user);
    }

    await user.save();
    return user;
  }

  public async verifyEmail(id: string, code: string): Promise<User> {
    if (!isValidObjectId(id)) return null;

    const user = await this.userModel.findById(id).exec();

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const verifyCode = user.emailVerificationCode;
    if (!verifyCode) {
      throw new BadRequestException('Email already verified.');
    }

    const bypass = process.env.NODE_ENV === 'development' && code === '123456';
    if (!bypass && user.emailVerificationCode !== code) {
      throw new BadRequestException('Invalid verification code.');
    }

    if (user.profileId == null) {
      const profile = await this.profileService.createProfile(user);
      user.profileId = profile._id;
    }

    user.emailVerificationCode = null;
    user.isEmailVerified = true;
    await user.save();
    return user;
  }

  public async updateUser(id: string, payload: Partial<User>): Promise<User> {
    if (!isValidObjectId(id)) return null;

    const user = await this.userModel.findById(id).exec();

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    if (payload.email) {
      const existent = await this.getByEmail(payload.email);

      if (existent) {
        throw new BadRequestException('User with this email already exists.');
      }
    }

    Object.assign(user, payload);
    await this.requireEmailVerificationFor(user);
    await user.save();
    return user;
  }
}
