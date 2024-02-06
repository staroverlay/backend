import { Controller, Get, NotFoundException, Param } from '@nestjs/common';

import { MediaService } from './media.service';

@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Get('/:mediaId')
  public async getMedia(@Param('mediaId') mediaId: string) {
    const media = await this.mediaService.getMediaByID(mediaId);
    if (!media) {
      throw new NotFoundException('Media not found');
    }

    return {
      name: media.name,
      size: media.size,
      type: media.type,
      url: `${process.env.WORKER_SERVER}/${media.resourceId}`,
    };
  }
}
