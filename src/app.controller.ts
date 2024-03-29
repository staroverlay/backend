import { BadRequestException, Controller, Get } from '@nestjs/common';

import { PlanService } from './modules/plan/plan.service';

@Controller('/')
export class AppController {
  private readonly start = Date.now();

  constructor(private readonly planService: PlanService) {}

  @Get('/')
  healthCheck() {
    return {
      env: process.env['NODE_ENV'],
      status: 'OK',
      uptime: Date.now() - this.start,
      version: process.env['npm_package_version'],
    };
  }

  @Get('/__dev__/init')
  async initData() {
    const defaultPlan = await this.planService.getDefaultPlan();
    if (defaultPlan) {
      throw new BadRequestException('Default plan already exist.');
    }

    const freePlan = await this.planService.createPlan({
      discountYearly: 0,
      isDefault: true,
      maxEditors: 0,
      maxStorageItems: 25,
      maxStorageSize: 1024 * 1024 * 50, // 50MB
      maxWidgets: 5,
      name: 'free',
      perkDesignLibrary: false,
      perkModChat: false,
      price: 0,
    });

    const proPlan = await this.planService.createPlan({
      discountYearly: 20,
      isDefault: false,
      maxEditors: 5,
      maxStorageItems: 100,
      maxStorageSize: 1024 * 1024 * 250, // 250MB
      maxWidgets: 10,
      name: 'Starter',
      perkDesignLibrary: true,
      perkModChat: true,
      sku: 'tier-1',
      price: 4,
    });

    return [freePlan, proPlan];
  }
}
