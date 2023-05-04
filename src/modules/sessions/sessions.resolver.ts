import {
  BadRequestException,
  InternalServerErrorException,
  UseGuards,
} from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Request } from 'express';

import AuthToken from 'src/decorators/auth-token.decorator';
import CurrentUser from 'src/decorators/current-user.decorator';
import GqlRequest from 'src/decorators/gql-request.decorator';

import { GqlAuthGuard } from 'src/auth/guards/gql-auth.guard';

import { Session } from './schema/session';
import { SessionsService } from './sessions.service';
import { SessionWithToken } from './schema/session-with-token';

import { TwitchService } from '../twitch/twitch.service';

import { UsersService } from '../users/users.service';
import { User } from '../users/models/user';
import { TwitchAPIException } from 'twitch-api-ts';

@Resolver(() => Resolver)
export class SessionsResolver {
  constructor(
    private sessionsService: SessionsService,
    private twitchService: TwitchService,
    private usersService: UsersService,
  ) {}

  @UseGuards(GqlAuthGuard)
  @Query(() => [Session])
  public getSessions(@CurrentUser() user: User): Promise<Session[]> {
    return this.sessionsService.getByUser(user.id);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Boolean)
  public async invalidateSession(@AuthToken() token: string): Promise<boolean> {
    return this.sessionsService.deleteByToken(token);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Boolean)
  public async invalidateAllSessions(
    @CurrentUser() user: User,
  ): Promise<boolean> {
    return this.sessionsService.deleteByUser(user.id);
  }

  @Query(() => String)
  public loginRedirectURL(): string {
    return this.twitchService.authenticate();
  }

  @Mutation(() => SessionWithToken)
  public async login(
    @GqlRequest() req: Request,
    @Args('access_token') access_token: string,
    @Args('refresh_token') refresh_token: string,
  ): Promise<SessionWithToken> {
    const twitchUser = await this.twitchService
      .getUserData(access_token)
      .catch((e: TwitchAPIException) => {
        const status = e.getStatusCode().toString();
        if (status.startsWith('4')) {
          throw new BadRequestException(e.message);
        } else {
          throw new InternalServerErrorException(e.message);
        }
      });

    const user = await this.usersService.getOrCreate(
      access_token,
      refresh_token,
      twitchUser,
    );
    return await this.sessionsService.createSession(
      user.id,
      req.socket.remoteAddress,
      req.headers['user-agent'],
    );
  }
}
