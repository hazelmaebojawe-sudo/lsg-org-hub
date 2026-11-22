import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CheckoutDto } from './dto/checkout.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  // Strict rate limit on the payment endpoint
  @Post('checkout')
  @Roles(Role.STUDENT)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  checkout(@Req() req: any, @Body() dto: CheckoutDto) {
    return this.payments.checkout(req.user, dto.feeItemId);
  }

  @Get('mine')
  @Roles(Role.STUDENT)
  mine(@Req() req: any) {
    return this.payments.listMine(req.user);
  }

  @Get('college')
  @Roles(Role.LSG_ADMIN)
  college(@Req() req: any) {
    return this.payments.listCollege(req.user);
  }

  @Get(':id')
  @Roles(Role.STUDENT)
  one(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.payments.get(req.user, id);
  }

  @Get(':id/receipt')
  @Roles(Role.STUDENT, Role.LSG_ADMIN)
  receipt(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.payments.receiptLink(req.user, id);
  }
}