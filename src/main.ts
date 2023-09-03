// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import ValidationPipe from './pipes/validation.pipe';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(ValidationPipe);
  app.enableCors({
    origin: [process.env['FRONTEND_SERVER'], process.env['WIDGETS_SERVER']],
  });

  const { PORT, HOST } = process.env;
  await app.listen(PORT, HOST);
  Logger.log(`Server listening on http://${HOST}:${PORT}`, 'NestApplication');
}

bootstrap();
