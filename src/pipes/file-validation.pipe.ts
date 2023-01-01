import { Injectable, PipeTransform } from '@nestjs/common';
import { FileType, getFileTypeByMime } from 'src/utils/file';

@Injectable()
export class FileValidation implements PipeTransform {
  transform(value: Express.Multer.File) {
    // Check size.
    const oneKb = 1024;
    const oneMB = oneKb * 1024;
    const limit = oneMB * 50;

    if (value.size > limit) {
      return false;
    }

    // Check type.
    const type = getFileTypeByMime(value.mimetype);
    if (type == FileType.UNKNOWN) {
      return false;
    }

    return true;
  }
}
