import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { IntegrationResolver } from './integration.resolver';
import { IntegrationService } from './integration.service';
import { Integration, IntegrationSchema } from './models/integration';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Integration.name,
        schema: IntegrationSchema,
      },
    ]),
  ],
  providers: [IntegrationResolver, IntegrationService],
  exports: [IntegrationService],
})
export class IntegrationModule {}
