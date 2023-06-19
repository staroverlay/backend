import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TwitchUser } from 'twitch-api-ts/lib/users';

import { User, UserDocument } from './models/user';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  public getByID(id: string): Promise<User | undefined> {
    return this.userModel.findOne({ id }).exec();
  }

  public async getOrCreate(
    access_token: string,
    refresh_token: string,
    twitchUser: TwitchUser,
  ): Promise<User> {
    const { profile_image_url, login, id, email } = twitchUser;

    let user = (await this.getByID(id)) as UserDocument;

    if (!user) {
      user = new this.userModel({
        id,
      });
    }

    user.accessToken = access_token;
    user.refreshToken = refresh_token;
    user.avatar = profile_image_url;
    user.email = email;
    user.username = login;

    await user.save();
    return user;
  }
}
