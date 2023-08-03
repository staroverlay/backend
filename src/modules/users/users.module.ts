import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { User, UserSchema } from './models/user';
import { UsersResolver } from './users.resolver';
import { UsersService } from './users.service';
import { IntegrationModule } from '../integration/integration.module';
import { TwitchModule } from '../twitch/twitch.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: User.name,
        schema: UserSchema,
      },
    ]),
    IntegrationModule,
    TwitchModule,
  ],
  providers: [UsersResolver, UsersService],
  exports: [UsersService],
})
export class UsersModule {}
