import { Module } from '@nestjs/common';

import { IntegrationModule } from '../integration/integration.module';
import { WidgetsModule } from '../widgets/widgets.module';
import { EventsGateway } from './events.gateway';
import { EventsResolver } from './events.resolver';
import { EventsService } from './events.service';

@Module({
  imports: [WidgetsModule, IntegrationModule],
  providers: [EventsResolver, EventsService, EventsGateway],
  exports: [EventsService],
})
export class EventsModule {}
