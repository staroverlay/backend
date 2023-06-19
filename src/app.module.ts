import { join } from 'path';

import { ApolloDriver } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { MongooseModule } from '@nestjs/mongoose';

import { AuthModule } from './auth/auth.module';
import { MediaModule } from './modules/media/media.module';
import { MembershipModule } from './modules/membership/membership.module';
import { PlanModule } from './modules/plan/plan.module';
import { R2Module } from './modules/r2/r2.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { TwitchModule } from './modules/twitch/twitch.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    /**
     * Using the GraphQL module it will load all the schemas automatically
     * and generate the .gql file
     * Also the playground mode and debug will only be available if the application
     *  is running under a development environment.
     */
    GraphQLModule.forRoot({
      autoSchemaFile: join(__dirname, 'graphql', 'schema.gql'),
      driver: ApolloDriver,
      path: '/',
    }),

    /**
     * Using the database module it will connect to the
     * mongodb server specified in the environment variable "MONGODB_URI"
     */
    MongooseModule.forRoot(process.env['MONGODB_URI']),

    /**
     * Load all the remaining modules that are responsible for managing different schemes and services.
     */
    AuthModule,
    MediaModule,
    MembershipModule,
    PlanModule,
    R2Module,
    SessionsModule,
    TwitchModule,
    UsersModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
