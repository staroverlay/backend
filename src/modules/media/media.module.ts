import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { R2Module } from '../r2/r2.module';
import { MediaController } from './media.controller';
import { MediaResolver } from './media.resolver';
import { MediaService } from './media.service';
import { Media, MediaSchema } from './models/media';

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
  controllers: [MediaController],
  exports: [MediaService],
})
export class MediaModule {}
