import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { MediaModule } from '../media/media.module';
import { UsersModule } from '../users/users.module';
import { Template, TemplateSchema } from './models/template';
import {
  TemplateVersion,
  TemplateVersionSchema,
} from './models/template-version';
import { TemplateResolver } from './template.resolver';
import { TemplateService } from './template.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Template.name,
        schema: TemplateSchema,
      },
      {
        name: TemplateVersion.name,
        schema: TemplateVersionSchema,
      },
    ]),
    MediaModule,
    UsersModule,
  ],
  providers: [TemplateResolver, TemplateService],
  exports: [TemplateService],
})
export class TemplateModule {}
