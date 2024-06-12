import { Module } from '@nestjs/common';

import { IntegrationModule } from '../integration/integration.module';
import { TemplateVersionModule } from '../template-version/template-version.module';
import { TemplateModule } from '../templates/template.module';
import { UsersModule } from '../users/users.module';
import { WidgetsModule } from '../widgets/widgets.module';
import { EventsGateway } from './events.gateway';
import { EventsService } from './events.service';

@Module({
  imports: [
    IntegrationModule,
    TemplateModule,
    TemplateVersionModule,
    WidgetsModule,
    UsersModule,
  ],
  providers: [EventsService, EventsGateway],
  exports: [EventsService],
})
export class EventsModule {}
