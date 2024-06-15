import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AcquisitionModule } from '../acquisition/acquisition.module';
import { ProfileModule } from '../profiles/profile.module';
import { SessionsModule } from '../sessions/sessions.module';
import { TemplateModule } from '../templates/template.module';
import {
  TemplateVersion,
  TemplateVersionSchema,
} from './models/template-version';
import { TemplateVersionController } from './template-version.controller';
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
    SessionsModule,
    ProfileModule
  ],
  providers: [TemplateVersionResolver, TemplateVersionService],
  exports: [TemplateVersionService],
  controllers: [TemplateVersionController]
})
export class TemplateVersionModule {}
