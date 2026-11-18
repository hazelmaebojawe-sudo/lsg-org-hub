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
import { AnnouncementsService } from './announcements.service';
import {
  CreateAnnouncementDto,
  UpdateAnnouncementDto,
} from './dto/announcement.dto';

@Controller('announcements')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnnouncementsController {
  constructor(private readonly announcements: AnnouncementsService) {}

  // Everyone signed in: the feed of their own college (cached)
  @Get()
  feed(@Req() req: any) {
    if (!req.user.collegeId) {
      throw new ForbiddenException('Finish your registration to choose a college');
    }
    return this.announcements.feed(req.user.collegeId);
  }

  // Which organizations can I post for?
  @Get('my-organizations')
  @Roles(Role.LSG_ADMIN, Role.OFFICER)
  myOrganizations(@Req() req: any) {
    return this.announcements.postableOrganizations(req.user);
  }

  @Post()
  @Roles(Role.LSG_ADMIN, Role.OFFICER)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  create(@Req() req: any, @Body() dto: CreateAnnouncementDto) {
    return this.announcements.create(req.user, dto);
  }

  @Patch(':id')
  @Roles(Role.LSG_ADMIN, Role.OFFICER)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  update(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAnnouncementDto,
  ) {
    return this.announcements.update(req.user, id, dto);
  }

  @Delete(':id')
  @Roles(Role.LSG_ADMIN, Role.OFFICER)
  remove(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.announcements.remove(req.user, id);
  }
}