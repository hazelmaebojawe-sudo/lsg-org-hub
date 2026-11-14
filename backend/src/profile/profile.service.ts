import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProfileDto, ProfileDetailsDto } from './dto/profile.dto';

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string) {
    const profile = await this.prisma.studentProfile.findUnique({
      where: { userId },
    });
    if (!profile) throw new NotFoundException('Profile not set up yet');
    return profile;
  }

  /** Register: pick a college (once) and save the PSGC address. */
  async register(userId: string, dto: CreateProfileDto) {
    const college = await this.prisma.college.findUnique({
      where: { id: dto.collegeId },
    });
    if (!college) throw new BadRequestException('Unknown college');

    const current = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { collegeId: true },
    });
    if (current?.collegeId && current.collegeId !== dto.collegeId) {
      throw new ForbiddenException(
        'Your college cannot be changed after registration',
      );
    }

    const { collegeId, ...details } = dto;
    return this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { collegeId } });
      return tx.studentProfile.upsert({
        where: { userId },
        update: details,
        create: { userId, ...details },
      });
    });
  }

  async update(userId: string, dto: ProfileDetailsDto) {
    const existing = await this.prisma.studentProfile.findUnique({
      where: { userId },
    });
    if (!existing) throw new NotFoundException('Profile not set up yet');
    return this.prisma.studentProfile.update({ where: { userId }, data: dto });
  }

  /** Deactivate (soft delete): the account can no longer sign in. */
  async deactivate(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });
    return { message: 'Account deactivated' };
  }
}
