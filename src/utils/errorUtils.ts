import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
  PayloadTooLargeException,
  UnauthorizedException,
} from '@nestjs/common';

type BodyWithError = {
  error?: {
    kind: string;
    message: string;
  };
};

export function validateStatus(statusCode: number, body: BodyWithError) {
  const { error } = body;
  if (!error) return;

  const { kind, message } = error;

  if (statusCode == 400) {
    throw new BadRequestException(kind, message);
  } else if (statusCode == 401) {
    throw new UnauthorizedException(kind, message);
  } else if (statusCode == 404) {
    throw new NotFoundException(kind, message);
  } else if (statusCode == 413) {
    throw new PayloadTooLargeException(kind, message);
  } else {
    console.error(body);
    throw new InternalServerErrorException('Internal Server Exception');
  }
}
