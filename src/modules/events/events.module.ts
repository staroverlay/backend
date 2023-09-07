import { Module } from '@nestjs/common';

import { EventsResolver } from './events.resolver';
import { EventsService } from './events.service';
import { WidgetsModule } from '../widgets/widgets.module';

@Module({
  imports: [WidgetsModule],
  providers: [EventsResolver, EventsService],
  exports: [EventsService],
})
export class EventsModule {}
