import { Module } from '@nestjs/common';

import { IntegrationModule } from '../integration/integration.module';
import { TemplateModule } from '../templates/template.module';
import { WidgetsModule } from '../widgets/widgets.module';
import { EventsGateway } from './events.gateway';
import { EventsResolver } from './events.resolver';
import { EventsService } from './events.service';

@Module({
  imports: [IntegrationModule, TemplateModule, WidgetsModule],
  providers: [EventsResolver, EventsService, EventsGateway],
  exports: [EventsService],
})
export class EventsModule {}
