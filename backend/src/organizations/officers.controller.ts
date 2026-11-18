import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
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
import { AssignOfficerDto } from './dto/officer.dto';
import { OfficersService } from './officers.service';

@Controller('organizations/:orgId/officers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.LSG_ADMIN)
export class OfficersController {
  constructor(private readonly officers: OfficersService) {}

  private collegeOf(user: { collegeId: string | null }): string {
    if (!user.collegeId) {
      throw new ForbiddenException('Your account has no college assigned');
    }
    return user.collegeId;
  }

  @Get()
  list(@Req() req: any, @Param('orgId', ParseUUIDPipe) orgId: string) {
    return this.officers.list(this.collegeOf(req.user), orgId);
  }

  @Post()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  assign(
    @Req() req: any,
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Body() dto: AssignOfficerDto,
  ) {
    return this.officers.assign(this.collegeOf(req.user), orgId, dto.email);
  }

  @Delete(':userId')
  remove(
    @Req() req: any,
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.officers.remove(this.collegeOf(req.user), orgId, userId);
  }
}
