import { Controller, Get } from '@nestjs/common';

@Controller('/')
export class AppController {
  private readonly start = Date.now();

  @Get('/')
  healthCheck() {
    return {
      status: 'OK',
      uptime: Date.now() - this.start,
      version: process.env['npm_package_version'],
    };
  }
}
