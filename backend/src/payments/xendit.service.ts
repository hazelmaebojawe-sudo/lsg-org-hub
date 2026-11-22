import {
  BadGatewayException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { timingSafeEqual } from 'crypto';

@Injectable()
export class XenditService {
  private readonly logger = new Logger(XenditService.name);

  /** Creates a Xendit invoice. Xendit takes pesos; our database stores centavos. */
  async createInvoice(input: {
    externalId: string;
    amountCentavos: number;
    description: string;
    successUrl: string;
    failureUrl: string;
  }): Promise<{ id: string; checkoutUrl: string }> {
    const secret = process.env.XENDIT_SECRET_KEY;
    if (!secret) throw new InternalServerErrorException('Payments are not configured');

    const res = await fetch('https://api.xendit.co/v2/invoices', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${secret}:`).toString('base64')}`,
      },
      body: JSON.stringify({
        external_id: input.externalId, // our payment id, returned in the webhook
        amount: input.amountCentavos / 100,
        currency: 'PHP',
        description: input.description,
        success_redirect_url: input.successUrl,
        failure_redirect_url: input.failureUrl,
        invoice_duration: 3600,
        should_send_email: false,
      }),
    });

    const json: any = await res.json().catch(() => null);
    if (!res.ok || !json?.id || !json?.invoice_url) {
      this.logger.error(`Xendit invoice failed: ${JSON.stringify(json)}`);
      throw new BadGatewayException('Could not start the payment. Please try again.');
    }
    return { id: json.id, checkoutUrl: json.invoice_url };
  }

  /** Xendit sends your verification token in the x-callback-token header. */
  verifyCallbackToken(token?: string): boolean {
    const expected = process.env.XENDIT_CALLBACK_TOKEN;
    if (!expected || !token) return false;
    const a = Buffer.from(token);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}