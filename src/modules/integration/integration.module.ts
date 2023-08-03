import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { IntegrationResolver } from './integration.resolver';
import { IntegrationService } from './integration.service';
import { Integration, IntegrationSchema } from './models/integration';
import { TwitchModule } from '../twitch/twitch.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Integration.name,
        schema: IntegrationSchema,
      },
    ]),
    TwitchModule,
  ],
  providers: [IntegrationResolver, IntegrationService],
  exports: [IntegrationService],
})
export class IntegrationModule {}
