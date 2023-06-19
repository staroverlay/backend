import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { MediaResolver } from './media.resolver';
import { MediaService } from './media.service';
import { Media, MediaSchema } from './models/media';
import { R2Module } from '../r2/r2.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Media.name,
        schema: MediaSchema,
      },
    ]),
    R2Module,
  ],
  providers: [MediaService, MediaResolver],
  exports: [MediaService],
})
export class MediaModule {}
