import { Injectable } from '@nestjs/common';
import { Transporter, createTransport } from 'nodemailer';

export type FROM = 'accounts' | 'support' | 'noreply';

@Injectable()
export class EmailService {
  private readonly transporter: Transporter;
  private readonly domain: string;

  constructor() {
    const { SMTP_DOMAIN, SMTP_ENDPOINT, SMTP_USERNAME, SMTP_PASSWORD } =
      process.env;
    this.domain = SMTP_DOMAIN;
    this.transporter = createTransport({
      host: SMTP_ENDPOINT,
      auth: {
        user: SMTP_USERNAME,
        pass: SMTP_PASSWORD,
      },
    });
  }

  async sendEmail(
    fromId: FROM,
    to: string,
    subject: string,
    body: string,
  ): Promise<boolean> {
    const from = `${fromId}@${this.domain}`;
    const info = await this.transporter.sendMail({
      from,
      to,
      subject,
      html: body,
    });

    if (info.messageId) {
      return true;
    } else {
      return false;
    }
  }
}
