import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { TwitchModule } from '../twitch/twitch.module';
import { UsersModule } from '../users/users.module';
import { Session, SessionSchema } from './schema/session';
import { SessionsResolver } from './sessions.resolver';
import { SessionsService } from './sessions.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Session.name,
        schema: SessionSchema,
      },
    ]),
    TwitchModule,
    UsersModule,
    JwtModule,
  ],
  providers: [SessionsResolver, SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
