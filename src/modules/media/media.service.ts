import {
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';

import { getFileTypeByMime } from '@/src/utils/fileUtils';

import { R2Service } from '../r2/r2.service';
import CreateMediaDTO from './dto/create-media.dto';
import { Media, MediaDocument } from './models/media';

@Injectable()
export class MediaService {
  constructor(
    private readonly r2: R2Service,

    @InjectModel(Media.name)
    private readonly mediaModel: Model<MediaDocument>,
  ) {}

  public async createMedia(
    userId: string,
    payload: CreateMediaDTO,
  ): Promise<Media> {
    const { contentType, name, size } = payload;

    const quota = await this.getMediaQuota(userId);
    const max = 50 * 1024 * 1024; // 50 MB

    if (quota + size > max) {
      throw new PayloadTooLargeException('Exceed your account storage quota');
    }

    const {
      id: resourceId,
      uploadId,
      thumbnailUploadId,
    } = await this.r2.createResource(contentType, size);
    const type = getFileTypeByMime(contentType);
    const media = new this.mediaModel({
      name,
      resourceId,
      size,
      type,
      userId,
      uploadId,
      thumbnailUploadId,
    });
    await media.save();
    return media;
  }

  public getMediaByUser(userId: string): Promise<Media[]> {
    return this.mediaModel.find({ userId }).exec();
  }

  public getMediaByID(id: string): Promise<Media> {
    if (!isValidObjectId(id)) {
      return null;
    }
    return this.mediaModel.findOne({ _id: id }).exec();
  }

  public async getMediaQuota(userId: string): Promise<number> {
    const medias = await this.getMediaByUser(userId);
    let quota = 0;

    for (const media of medias) {
      quota += media.size;
    }

    return quota;
  }

  public async completeResource(
    userId: string,
    id: string,
    parts: any[],
    thumbnailParts: any[],
  ) {
    const media = await this.getMediaByID(id);
    if (!media || media.userId != userId)
      throw new NotFoundException("Media with this ID doesn't exist.");

    if (!media.uploadId && !media.thumbnailUploadId)
      throw new NotFoundException('Media is not in uploading state.');

    if (media.uploadId) {
      await this.r2.completeResource(media.resourceId, media.uploadId, parts);
      media.uploadId = null;
    }

    if (media.thumbnailUploadId) {
      await this.r2.completeResource(
        `${media.resourceId}/thumbnail`,
        media.thumbnailUploadId,
        thumbnailParts,
      );
      media.thumbnailUploadId = null;
    }

    await (media as MediaDocument).save();
    return media;
  }

  public async deleteMedia(userId: string, id: string): Promise<boolean> {
    const media = await this.getMediaByID(id);
    if (!media || media.userId != userId)
      throw new NotFoundException("Media with this ID doesn't exist.");

    if (media.uploadId) {
      await this.r2.abortResource(media.resourceId, media.uploadId);
      if (media.thumbnailUploadId) {
        await this.r2.abortResource(
          `${media.resourceId}/thumbnail`,
          media.thumbnailUploadId,
        );
      }
    } else {
      await this.r2.deleteResource(media.resourceId);
      await this.r2.deleteResource(`${media.resourceId}/thumbnail`);
    }

    const { deletedCount } = await this.mediaModel.deleteOne({
      userId,
      _id: id,
    });
    return deletedCount > 0;
  }
}
