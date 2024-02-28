import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { TemplateModule } from '../templates/template.module';
import { Widget, WidgetSchema } from './models/widget';
import { WidgetsResolver } from './widgets.resolver';
import { WidgetsService } from './widgets.service';

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
