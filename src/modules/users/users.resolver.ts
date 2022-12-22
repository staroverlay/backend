import { Resolver, Query } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { User } from './models/user';
import { UsersService } from './users.service';
import { GqlAuthGuard } from 'src/auth/guards/gql-auth.guard';

import CurrentUser from 'src/decorators/current-user.decorator';

@Resolver(() => User)
export class UsersResolver {
  constructor(private usersService: UsersService) {}

  @Query(() => User)
  @UseGuards(GqlAuthGuard)
  async getCurrentUser(@CurrentUser() user: User): Promise<User> {
    return user;
  }
}
