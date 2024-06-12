import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AcquisitionModule } from '../acquisition/acquisition.module';
import { TemplateModule } from '../templates/template.module';
import {
  TemplateVersion,
  TemplateVersionSchema,
} from './models/template-version';
import { TemplateVersionResolver } from './template-version.resolver';
import { TemplateVersionService } from './template-version.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: TemplateVersion.name,
        schema: TemplateVersionSchema,
      },
    ]),
    AcquisitionModule,
    TemplateModule,
  ],
  providers: [TemplateVersionResolver, TemplateVersionService],
  exports: [TemplateVersionService],
})
export class TemplateVersionModule {}
