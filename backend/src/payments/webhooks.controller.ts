import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
  type RawBodyRequest,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import { PaymentsService } from './payments.service';

@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly payments: PaymentsService) {}

  // Called by PayMongo. No login: protected by the signature check instead.
  @Post('paymongo')
  @HttpCode(200)
  @SkipThrottle()
  async paymongo(
    @Req() req: RawBodyRequest<Request>,
    @Headers('paymongo-signature') signature?: string,
  ) {
    if (!req.rawBody) throw new BadRequestException('Missing body');
    await this.payments.handlePaymongoWebhook(req.rawBody.toString('utf8'), signature);
    return { received: true };
  }

  // Called by Xendit. No login: protected by the x-callback-token header instead.
  @Post('xendit')
  @HttpCode(200)
  @SkipThrottle()
  async xendit(
    @Body() body: Record<string, unknown>,
    @Headers('x-callback-token') token?: string,
  ) {
    await this.payments.handleXenditWebhook(body, token);
    return { received: true };
  }
}