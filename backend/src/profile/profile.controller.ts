import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CaptchaService } from '../captcha/captcha.service';
import { CreateProfileDto, ProfileDetailsDto } from './dto/profile.dto';
import { ProfileService } from './profile.service';

@Controller('profile')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.STUDENT)
export class ProfileController {
  constructor(
    private readonly profile: ProfileService,
    private readonly captcha: CaptchaService,
  ) {}

  @Get()
  get(@Req() req: any) {
    return this.profile.get(req.user.id);
  }

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async register(@Req() req: any, @Body() dto: CreateProfileDto) {
    await this.captcha.verify(dto.captchaToken, req.ip); // reject bots first
    const { captchaToken, ...data } = dto; // the token is not a database column
    return this.profile.register(req.user.id, data);
  }

  @Patch()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  update(@Req() req: any, @Body() dto: ProfileDetailsDto) {
    return this.profile.update(req.user.id, dto);
  }

  @Delete()
  async deactivate(
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.profile.deactivate(req.user.id);
    res.clearCookie('access_token');
    return result;
  }
}
