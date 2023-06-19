import { Field, ObjectType } from '@nestjs/graphql';

import { User } from 'src/modules/users/models/user';

import { SessionWithToken } from './session-with-token';

@ObjectType()
export class SessionWithTokenAndUser {
  @Field()
  session: SessionWithToken;

  @Field()
  user: User;
}
