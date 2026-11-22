import {
  BadGatewayException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';

@Injectable()
export class PaymongoService {
  private readonly logger = new Logger(PaymongoService.name);

  /** Creates a PayMongo checkout. Amounts are whole numbers in centavos (PHP 150.00 = 15000). */
  async createCheckout(input: {
    amountCentavos: number;
    name: string;
    description: string;
    successUrl: string;
    cancelUrl: string;
    paymentId: string;
  }): Promise<{ id: string; checkoutUrl: string }> {
    const secret = process.env.PAYMONGO_SECRET_KEY;
    if (!secret) throw new InternalServerErrorException('Payments are not configured');

    const res = await fetch('https://api.paymongo.com/v1/checkout_sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${secret}:`).toString('base64')}`,
      },
      body: JSON.stringify({
        data: {
          attributes: {
            line_items: [
              {
                currency: 'PHP',
                amount: input.amountCentavos,
                name: input.name,
                quantity: 1,
                description: input.description,
              },
            ],
            payment_method_types: ['gcash', 'card', 'paymaya'],
            description: input.description,
            success_url: input.successUrl,
            cancel_url: input.cancelUrl,
            send_email_receipt: false,
            show_description: true,
            show_line_items: true,
            metadata: { paymentId: input.paymentId },
          },
        },
      }),
    });

    const json: any = await res.json().catch(() => null);
    if (!res.ok || !json?.data?.id) {
      this.logger.error(`PayMongo checkout failed: ${JSON.stringify(json?.errors ?? json)}`);
      throw new BadGatewayException('Could not start the payment. Please try again.');
    }
    return { id: json.data.id, checkoutUrl: json.data.attributes.checkout_url };
  }

  /** Verifies the Paymongo-Signature header: HMAC-SHA256 of "<timestamp>.<raw body>". */
  verifySignature(rawBody: string, header?: string): boolean {
    const secret = process.env.PAYMONGO_WEBHOOK_SECRET;
    if (!secret || !header) return false;

    const parts: Record<string, string> = {};
    for (const piece of header.split(',')) {
      const i = piece.indexOf('=');
      if (i > 0) parts[piece.slice(0, i).trim()] = piece.slice(i + 1).trim();
    }
    if (!parts.t) return false;

    const expected = createHmac('sha256', secret)
      .update(`${parts.t}.${rawBody}`)
      .digest('hex');

    // te = test-mode signature, li = live-mode signature
    return [parts.te, parts.li]
      .filter((sig): sig is string => !!sig)
      .some((sig) => {
        const a = Buffer.from(sig);
        const b = Buffer.from(expected);
        return a.length === b.length && timingSafeEqual(a, b);
      });
  }
}