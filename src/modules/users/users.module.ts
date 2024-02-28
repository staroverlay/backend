import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { IntegrationModule } from '../integration/integration.module';
import { ProfileModule } from '../profiles/profile.module';
import { TwitchModule } from '../twitch/twitch.module';
import { User, UserSchema } from './models/user';
import { UsersResolver } from './users.resolver';
import { UsersService } from './users.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: User.name,
        schema: UserSchema,
      },
    ]),
    IntegrationModule,
    ProfileModule,
    TwitchModule,
  ],
  providers: [UsersResolver, UsersService],
  exports: [UsersService],
})
export class UsersModule {}
