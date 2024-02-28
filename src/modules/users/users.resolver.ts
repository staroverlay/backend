import {
  BadRequestException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import * as bcrypt from 'bcrypt';

import { randomString } from '@/src/utils/randomUtils';
import { GqlAuthGuard } from 'src/auth/guards/gql-auth.guard';
import CurrentUser from 'src/decorators/current-user.decorator';

import { IntegrationService } from '../integration/integration.service';
import { ProfileService } from '../profiles/profile.service';
import { TwitchService } from '../twitch/twitch.service';
import { CreateUserDTO } from './dto/create-user.dto';
import { UpdatePasswordDTO } from './dto/update-password.dto';
import { UpdateUserDTO } from './dto/update-user.dto';
import { User } from './models/user';
import { UsersService } from './users.service';

@Resolver(() => User)
export class UsersResolver {
  constructor(
    private integrationService: IntegrationService,
    private profileService: ProfileService,
    private twitchService: TwitchService,
    private usersService: UsersService,
  ) {}

  @Query(() => User)
  @UseGuards(GqlAuthGuard)
  async getCurrentUser(@CurrentUser() user: User): Promise<User> {
    return user;
  }

  @Mutation(() => User)
  async createUser(@Args('payload') payload: CreateUserDTO): Promise<User> {
    return await this.usersService.createUser(payload);
  }

  @Mutation(() => User)
  async createUserWithTwitch(@Args('code') code: string): Promise<User> {
    const tokens = await this.twitchService.verifyCode(code);
    const twitchUser = await this.twitchService.getUserData(
      tokens.access_token,
    );
    const existent = await this.integrationService.getByIntegrationId(
      twitchUser.id,
      'twitch',
    );

    if (existent) {
      throw new BadRequestException('Twitch account already linked.');
    }

    const payload: CreateUserDTO = {
      email: twitchUser.email,
      username: twitchUser.login,
      password: randomString(16),
    };

    const user = await this.usersService.createUser(payload);
    const integration = await this.integrationService.createIntegration(
      user._id,
      twitchUser.id,
      tokens.access_token,
      tokens.refresh_token,
      twitchUser.login,
      twitchUser.profile_image_url,
      'twitch',
      Date.now() + tokens.expires_in * 1000,
    );
    await this.profileService.updateProfileWithIntegration(
      user.profileId,
      integration,
    );
    return user;
  }

  @Mutation(() => User)
  @UseGuards(GqlAuthGuard)
  async verifyEmail(
    @CurrentUser() user: User,
    @Args('code') code: string,
  ): Promise<User> {
    return await this.usersService.verifyEmail(user._id, code);
  }

  @Mutation(() => User)
  @UseGuards(GqlAuthGuard)
  async updateUser(
    @CurrentUser() user: User,
    @Args('payload') payload: UpdateUserDTO,
  ): Promise<User> {
    return await this.usersService.updateUser(user._id, payload);
  }

  @Mutation(() => User)
  @UseGuards(GqlAuthGuard)
  async updatePassword(
    @CurrentUser() user: User,
    @Args('payload') payload: UpdatePasswordDTO,
  ): Promise<User> {
    const valid = await bcrypt.compare(payload.oldPassword, user.password);
    if (!valid) {
      throw new UnauthorizedException('Invalid old password.');
    }

    return await this.usersService.updateUser(user._id, {
      password: payload.newPassword,
    });
  }
}
