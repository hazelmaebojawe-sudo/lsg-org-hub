import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ClearanceService } from './clearance.service';
import { IssueClearanceDto } from './dto/clearance.dto';

@Controller('clearances')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClearanceController {
  constructor(private readonly clearance: ClearanceService) {}

  @Get('candidates')
  @Roles(Role.LSG_ADMIN)
  candidates(
    @Req() req: any,
    @Query('semester') semester = '',
    @Query('schoolYear') schoolYear = '',
  ) {
    return this.clearance.candidates(req.user, semester, schoolYear);
  }

  @Post()
  @Roles(Role.LSG_ADMIN)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  issue(@Req() req: any, @Body() dto: IssueClearanceDto) {
    return this.clearance.issue(req.user, dto.userId, dto.semester, dto.schoolYear);
  }

  @Patch(':id/revoke')
  @Roles(Role.LSG_ADMIN)
  revoke(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.clearance.revoke(req.user, id);
  }

  @Get('mine')
  @Roles(Role.STUDENT, Role.OFFICER)
  mine(@Req() req: any) {
    return this.clearance.mine(req.user);
  }
}