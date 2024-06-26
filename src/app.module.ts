import { join } from 'path';

import { ApolloDriver } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { MongooseModule } from '@nestjs/mongoose';

import { EventEmitterModule } from '@nestjs/event-emitter';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { AcquisitionModule } from './modules/acquisition/acquisition.module';
import { EmailModule } from './modules/email/email.module';
import { EventsModule } from './modules/events/events.module';
import { IntegrationModule } from './modules/integration/integration.module';
import { MediaModule } from './modules/media/media.module';
import { MembershipModule } from './modules/membership/membership.module';
import { OAuthModule } from './modules/oauth/oauth.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { PlanModule } from './modules/plan/plan.module';
import { ProfileModule } from './modules/profiles/profile.module';
import { R2Module } from './modules/r2/r2.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { TemplateVersionModule } from './modules/template-version/template-version.module';
import { TemplateModule } from './modules/templates/template.module';
import { TwitchModule } from './modules/twitch/twitch.module';
import { UsersModule } from './modules/users/users.module';
import { WidgetsModule } from './modules/widgets/widgets.module';

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
      path: '/graphql',
      debug: process.env['NODE_ENV'] === 'development',
      playground: process.env['NODE_ENV'] === 'development',
    }),

    /**
     * Using the database module it will connect to the
     * mongodb server specified in the environment variable "MONGODB_URI"
     */
    MongooseModule.forRoot(process.env['MONGODB_URI']),

    /**
     * Using the event emitter module it will allow to emit events
     */
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      verboseMemoryLeak: true,
      ignoreErrors: false,
    }),

    /**
     * Load all the remaining modules that are responsible for managing different schemes and services.
     */
    AcquisitionModule,
    AuthModule,
    EmailModule,
    EventsModule,
    IntegrationModule,
    MediaModule,
    MembershipModule,
    OAuthModule,
    PaymentsModule,
    PlanModule,
    ProfileModule,
    R2Module,
    SessionsModule,
    TemplateModule,
    TemplateVersionModule,
    TwitchModule,
    UsersModule,
    WidgetsModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
