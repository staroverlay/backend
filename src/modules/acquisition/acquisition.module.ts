import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TemplateModule } from '../templates/template.module';
import { AcquisitionResolver } from './acquisition.resolver';
import { AcquisitionService } from './acquisition.service';
import { Acquisition, AcquisitionSchema } from './models/acquisition';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Acquisition.name,
        schema: AcquisitionSchema,
      },
    ]),
    TemplateModule,
  ],
  providers: [AcquisitionService, AcquisitionResolver],
  exports: [AcquisitionService],
})
export class AcquisitionModule {}
