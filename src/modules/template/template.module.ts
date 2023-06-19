import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Template, TemplateSchema } from './models/template';
import { TemplateResolver } from './template.resolver';
import { TemplateService } from './template.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Template.name,
        schema: TemplateSchema,
      },
    ]),
  ],
  providers: [TemplateResolver, TemplateService],
  exports: [TemplateService],
})
export class TemplateModule {}
