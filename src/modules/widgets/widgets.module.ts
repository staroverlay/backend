import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Widget, WidgetSchema } from './models/widget';
import { WidgetsResolver } from './widgets.resolver';
import { WidgetsService } from './widgets.service';
import { TemplateModule } from '../templates/template.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Widget.name,
        schema: WidgetSchema,
      },
    ]),
    TemplateModule,
  ],
  providers: [WidgetsService, WidgetsResolver],
  exports: [WidgetsService],
})
export class WidgetsModule {}
