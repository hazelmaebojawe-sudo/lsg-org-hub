import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ApplyDto, ReviewDto, UploadFileDto } from './dto/membership.dto';
import { MembershipsService } from './memberships.service';
import type { UploadedFileData } from './upload.types';

@Controller('memberships')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MembershipsController {
  constructor(private readonly memberships: MembershipsService) {}

  @Post()
  @Roles(Role.STUDENT)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  apply(@Req() req: any, @Body() dto: ApplyDto) {
    return this.memberships.apply(req.user, dto.organizationId);
  }

  @Get('mine')
  @Roles(Role.STUDENT)
  mine(@Req() req: any) {
    return this.memberships.listMine(req.user);
  }

  // Signed link to view a submitted file (owner, or officer/admin of that organization)
  @Get('files/:fileId/url')
  fileUrl(@Req() req: any, @Param('fileId', ParseUUIDPipe) fileId: string) {
    return this.memberships.fileUrl(req.user, fileId);
  }

  @Post(':id/files')
  @Roles(Role.STUDENT)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  upload(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UploadFileDto,
        @UploadedFile() file: UploadedFileData,
  ) {
    if (!file) throw new BadRequestException('Choose a file to upload');
    return this.memberships.uploadFile(req.user, id, dto.requirementId, file);
  }

  @Delete(':id')
  @Roles(Role.STUDENT)
  withdraw(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.memberships.withdraw(req.user, id);
  }

  @Patch(':id/review')
  @Roles(Role.OFFICER, Role.LSG_ADMIN)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  review(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewDto,
  ) {
    return this.memberships.review(req.user, id, dto.decision, dto.remarks);
  }
}