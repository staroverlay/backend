import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Widget, WidgetSchema } from './models/widget';
import { WidgetsService } from './widgets.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Widget.name,
        schema: WidgetSchema,
      },
    ]),
  ],
  providers: [WidgetsService],
  exports: [WidgetsService],
})
export class WidgetsModule {}
