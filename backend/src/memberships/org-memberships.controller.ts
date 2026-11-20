import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
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
import { RequirementDto } from './dto/membership.dto';
import { MembershipsService } from './memberships.service';

@Controller('organizations/:orgId')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrgMembershipsController {
  constructor(private readonly memberships: MembershipsService) {}

  // Anyone in the college can see what an organization requires
  @Get('requirements')
  requirements(@Req() req: any, @Param('orgId', ParseUUIDPipe) orgId: string) {
    return this.memberships.listRequirements(req.user, orgId);
  }

  @Post('requirements')
  @Roles(Role.OFFICER, Role.LSG_ADMIN)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  addRequirement(
    @Req() req: any,
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Body() dto: RequirementDto,
  ) {
    return this.memberships.addRequirement(req.user, orgId, dto);
  }

  @Delete('requirements/:requirementId')
  @Roles(Role.OFFICER, Role.LSG_ADMIN)
  removeRequirement(
    @Req() req: any,
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('requirementId', ParseUUIDPipe) requirementId: string,
  ) {
    return this.memberships.removeRequirement(req.user, orgId, requirementId);
  }

  @Get('memberships')
  @Roles(Role.OFFICER, Role.LSG_ADMIN)
  applications(
    @Req() req: any,
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Query('status') status?: string,
  ) {
    return this.memberships.listForOrg(req.user, orgId, status);
  }
}