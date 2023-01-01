import { Injectable, ImATeapotException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import { randomString } from 'src/utils/random';
import CreateMediaDTO from './dto/create-media.dto';
import { Media, MediaDocument } from './models/media';

@Injectable()
export class MediaService {
  constructor(
    @InjectModel(Media.name)
    private readonly mediaModel: Model<MediaDocument>,
  ) {}

  public async createMedia(
    userId: string,
    payload: CreateMediaDTO,
  ): Promise<Media> {
    const quota = await this.getMediaQuota(userId);
    const max = 512 * 1024 * 1024; // 512 MB
    if (quota + payload.size > max) {
      throw new ImATeapotException('Exceed your account storage quota');
    }

    const media = new this.mediaModel(payload);
    media.userId = userId;
    media.writeToken = randomString(32);
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

  public async deleteMedia(userId: string, mediaId: string): Promise<boolean> {
    const { deletedCount } = await this.mediaModel.deleteOne({
      userId,
      id: mediaId,
    });
    return deletedCount > 0;
  }
}
