import { BadRequestException, UseGuards } from '@nestjs/common';
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
    @Args('code') code: string,
  ): Promise<SessionWithToken> {
    const twitchSession = await this.twitchService
      .verifyCode(code)
      .catch(() => {
        throw new BadRequestException('Invalid twitch code');
      });

    const twitchUser = await this.twitchService.getUserData(
      twitchSession.access_token,
    );

    const user = await this.usersService.getOrCreate(twitchSession, twitchUser);
    return await this.sessionsService.createSession(
      user.id,
      req.socket.remoteAddress,
      req.headers['user-agent'],
    );
  }
}
