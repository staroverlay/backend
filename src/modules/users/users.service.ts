import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';

import { CreateUserDTO } from './dto/create-user.dto';
import { User, UserDocument } from './models/user';
import { Integration } from '../integration/models/integration';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  public getByID(id: string): Promise<User | null> {
    if (!isValidObjectId(id)) return null;

    return this.userModel.findById(id).exec();
  }

  public getByEmail(email: string): Promise<User | null> {
    return this.userModel.findOne({ email }).exec();
  }

  public async createUser({ email, password, username }: CreateUserDTO) {
    const existent = await this.getByEmail(email);

    if (existent) {
      throw new BadRequestException('User with this email already exists.');
    }

    const user = new this.userModel({
      email,
      password,
      username,
    });

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

    user.emailVerificationCode = null;
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
    await user.save();
    return user;
  }

  public async updateUserWithIntegration(id: string, integration: Integration) {
    return await this.updateUser(id, {
      avatar: integration.avatar,
      username: integration.username,
    });
  }
}
