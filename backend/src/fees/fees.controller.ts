import {
  Body,
  Controller,
  Delete,
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
import { CreateFeeDto } from './dto/fee.dto';
import { FeesService } from './fees.service';

@Controller('fees')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FeesController {
  constructor(private readonly fees: FeesService) {}

  @Get('payable')
  @Roles(Role.STUDENT)
  payable(@Req() req: any) {
    return this.fees.listPayable(req.user);
  }

  @Get('organization/:orgId')
  @Roles(Role.OFFICER, Role.LSG_ADMIN)
  forOrg(@Req() req: any, @Param('orgId', ParseUUIDPipe) orgId: string) {
    return this.fees.listForOrg(req.user, orgId);
  }

  @Post()
  @Roles(Role.OFFICER, Role.LSG_ADMIN)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  create(@Req() req: any, @Body() dto: CreateFeeDto) {
    return this.fees.create(req.user, dto);
  }

  @Delete(':id')
  @Roles(Role.OFFICER, Role.LSG_ADMIN)
  remove(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.fees.remove(req.user, id);
  }
}