import { Module } from '@nestjs/common';
import { FeesModule } from '../fees/fees.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymongoService } from './paymongo.service';
import { WebhooksController } from './webhooks.controller';
import { XenditService } from './xendit.service';

@Module({
  imports: [FeesModule],
  controllers: [PaymentsController, WebhooksController],
  providers: [PaymentsService, PaymongoService, XenditService],
})
export class PaymentsModule {}