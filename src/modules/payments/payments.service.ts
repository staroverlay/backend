import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { Axios } from 'axios';

import { Plan } from '../plan/models/plan';
import Payment from './interfaces/payment';

@Injectable()
export class PaymentsService {
  private client: Axios;

  constructor() {
    const BASE = 'https://store.xsolla.com/api/v2/project';
    const PROJECT_ID = process.env['XSOLLA_PROJECT_ID'];

    this.client = new Axios({
      baseURL: `${BASE}/${PROJECT_ID}`,
      auth: {
        username: process.env['XSOLLA_PROJECT_ID'],
        password: process.env['XSOLLA_API_KEY'],
      },
      headers: {
        'Content-Type': 'application/json',
      },
      transformRequest: [(data) => JSON.stringify(data)],
      transformResponse: [(data) => JSON.parse(data)],
    });
  }

  async createPayment(userId: string, plan: Plan): Promise<Payment> {
    if (!plan.sku)
      throw new BadRequestException('This plan is not available for purchase.');

    const res = await this.client.post('/admin/payment/token', {
      user: {
        id: {
          value: userId,
        },
      },
      sandbox: true,
      purchase: {
        items: [
          {
            sku: plan.sku,
            currency: 'USD',
            quantity: 1,
          },
        ],
      },
    });

    const { token, order_id } = res.data;

    if (!token || !order_id) {
      console.error('Failed to create payment.', res.data);
      throw new InternalServerErrorException('Failed to create payment.');
    }

    const DEV = 'https://sandbox-secure.xsolla.com/paystation4/?token=' + token;
    const PROD = 'https://secure.xsolla.com/paystation4/?token=' + token;

    return {
      url: process.env['NODE_ENV'] === 'production' ? PROD : DEV,
    };
  }
}
