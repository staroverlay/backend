import { BadRequestException, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import * as bcrypt from 'bcrypt';
import { Request } from 'express';

import { GqlAuthGuard } from 'src/auth/guards/gql-auth.guard';
import AuthToken from 'src/decorators/auth-token.decorator';
import CurrentUser from 'src/decorators/current-user.decorator';
import GqlRequest from 'src/decorators/gql-request.decorator';

import CreateSessionDTO from './dto/create-session.dto';
import { Session } from './schema/session';
import { SessionWithTokenAndUser } from './schema/session-with-token-and-user';
import { SessionsService } from './sessions.service';
import { IntegrationService } from '../integration/integration.service';
import { TwitchService } from '../twitch/twitch.service';
import { User } from '../users/models/user';
import { UsersService } from '../users/users.service';

@Resolver(() => Session)
export class SessionsResolver {
  constructor(
    private integrationService: IntegrationService,
    private sessionsService: SessionsService,
    private twitchService: TwitchService,
    private usersService: UsersService,
  ) {}

  @UseGuards(GqlAuthGuard)
  @Query(() => [Session])
  public getSessions(@CurrentUser() user: User): Promise<Session[]> {
    return this.sessionsService.getByUser(user._id);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Boolean)
  public async invalidateSessionByID(
    @CurrentUser() user: User,
    @Args('id') id: string,
  ): Promise<any> {
    return this.sessionsService.deleteByUserAndID(id, user._id);
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
    return this.sessionsService.deleteByUser(user._id);
  }

  @Mutation(() => SessionWithTokenAndUser)
  public async createSession(
    @GqlRequest() req: Request,
    @Args('payload') payload: CreateSessionDTO,
  ): Promise<SessionWithTokenAndUser> {
    const user = await this.usersService.getByEmail(payload.email);

    if (user == null) {
      throw new BadRequestException('Invalid email or password.');
    }

    const passwordMatch = await bcrypt.compare(payload.password, user.password);

    if (!passwordMatch) {
      throw new BadRequestException('Invalid email or password.');
    }

    const session = await this.sessionsService.createSession(
      user._id,
      req.socket.remoteAddress,
      req.headers['user-agent'],
    );

    return { session, user };
  }

  @Mutation(() => SessionWithTokenAndUser)
  public async createSessionWithTwitch(
    @GqlRequest() req: Request,
    @Args('code') code: string,
  ): Promise<SessionWithTokenAndUser> {
    const tokens = await this.twitchService.verifyCode(code);
    const twitchUser = await this.twitchService.getUserData(
      tokens.access_token,
    );

    const integration = await this.integrationService.getByIntegrationId(
      twitchUser.id,
      'twitch',
    );

    if (integration == null) {
      throw new BadRequestException(
        "You don't have a Twitch account linked to your account.",
      );
    }

    const user = await this.usersService.getByID(integration.ownerId);
    const session = await this.sessionsService.createSession(
      user._id,
      req.socket.remoteAddress,
      req.headers['user-agent'],
      'twitch',
    );

    return { session, user };
  }
}
