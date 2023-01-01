import { Body, Controller, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import * as multer from 'multer';
import { diskStorage, Multer } from 'multer';
import { nanoid } from 'nanoid';
import { normalize } from 'path';

import { getFileTypeByMime } from 'src/utils/file';
import UploadMediaDTO from './dto/upload-media.dto';
import { MediaService } from './media.service';

@Controller('/media')
export class MediaController {
  private multer: Multer;

  constructor(private mediaService: MediaService) {
    this.multer = multer({
      limits: {
        fileSize: 1024 * 1024 * 50,
      },
      storage: diskStorage({
        destination: normalize(
          process.env['CDN_UPLOAD_DIR'].replace('{dir}', __dirname),
        ),
        filename(_req, _file, callback) {
          callback(null, nanoid());
        },
      }),
    });
  }

  uploadFileWithMulter(
    req: Request,
    res: Response,
  ): Promise<Express.Multer.File> {
    return new Promise((resolve, reject) => {
      const middleware = this.multer.single('file');
      middleware(req, res, () => {
        const file = req.file;
        if (file) {
          resolve(file);
        } else {
          reject();
        }
      });
    });
  }

  @Post()
  async uploadFile(
    @Body()
    payload: UploadMediaDTO,
    @Req()
    req: Request,
    @Res()
    res: Response,
  ) {
    const media = await this.mediaService.getMediaByID(payload.id);

    if (media && media.writeToken && media.writeToken === payload.writeToken) {
      const file = await this.uploadFileWithMulter(req, res);
      const type = getFileTypeByMime(file.mimetype);
      media.type = type;
      media.size = file.size;
      media.writeToken = null;
    }

    return null;
  }
}
