import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Widget, WidgetSchema } from './models/widget';
import { WidgetsController } from './widgets.controller';
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
  controllers: [WidgetsController],
  providers: [WidgetsService, WidgetsResolver],
  exports: [WidgetsService],
})
export class WidgetsModule {}
