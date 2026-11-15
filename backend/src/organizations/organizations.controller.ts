import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import {
  CreateOrganizationDto,
  UpdateOrganizationDto,
} from './dto/organization.dto';
import { OrganizationsService } from './organizations.service';

@Controller('organizations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrganizationsController {
  constructor(private readonly orgs: OrganizationsService) {}

  /** Students, officers and admins only ever see their OWN college. */
  private collegeOf(user: { collegeId: string | null }): string {
    if (!user.collegeId) {
      throw new ForbiddenException('Finish your registration to choose a college');
    }
    return user.collegeId;
  }

  // Any signed-in user: active organizations of their college (cached)
  @Get()
  list(@Req() req: any) {
    return this.orgs.listForCollege(this.collegeOf(req.user));
  }

  // LSG Admin: everything, including deactivated organizations
  @Get('manage')
  @Roles(Role.LSG_ADMIN)
  listAll(@Req() req: any) {
    return this.orgs.listAll(this.collegeOf(req.user));
  }

  @Post()
  @Roles(Role.LSG_ADMIN)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  create(@Req() req: any, @Body() dto: CreateOrganizationDto) {
    return this.orgs.create(this.collegeOf(req.user), dto);
  }

  @Patch(':id')
  @Roles(Role.LSG_ADMIN)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  update(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.orgs.update(this.collegeOf(req.user), id, dto);
  }

  @Delete(':id')
  @Roles(Role.LSG_ADMIN)
  deactivate(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.orgs.deactivate(this.collegeOf(req.user), id);
  }
}
