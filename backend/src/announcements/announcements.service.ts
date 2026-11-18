import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Cache } from 'cache-manager';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateAnnouncementDto,
  UpdateAnnouncementDto,
} from './dto/announcement.dto';

type AuthUser = { id: string; role: Role; collegeId: string | null };

const CACHE_TTL_MS = 5 * 60 * 1000; // cached feed expires after 5 minutes
const FEED_LIMIT = 50;
// Same key is cleared by OrganizationsService when an organization changes
const feedKey = (collegeId: string) => `announcements:college:${collegeId}`;

const FEED_SELECT = {
  id: true,
  title: true,
  body: true,
  createdAt: true,
  updatedAt: true,
  organization: { select: { id: true, name: true, type: true } },
  author: { select: { fullName: true } },
} as const;

@Injectable()
export class AnnouncementsService {
  private readonly logger = new Logger(AnnouncementsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  /** Latest announcements of one college, from active organizations (cached). */
  async feed(collegeId: string) {
    const key = feedKey(collegeId);
    const cached = await this.cache.get<unknown[]>(key);
    if (cached) {
      this.logger.log(`cache HIT  ${key}`);
      return cached;
    }

    this.logger.log(`cache MISS ${key} -> reading database`);
    const rows = await this.prisma.announcement.findMany({
      where: { organization: { collegeId, isActive: true } },
      orderBy: { createdAt: 'desc' },
      take: FEED_LIMIT,
      select: FEED_SELECT,
    });
    await this.cache.set(key, rows, CACHE_TTL_MS);
    return rows;
  }

  /** Organizations this user may post for: all (admin) or only their own (officer). */
  async postableOrganizations(user: AuthUser) {
    const collegeId = this.requireCollege(user);

    if (user.role === Role.LSG_ADMIN) {
      return this.prisma.organization.findMany({
        where: { collegeId, isActive: true },
        orderBy: [{ type: 'asc' }, { name: 'asc' }],
        select: { id: true, name: true, type: true },
      });
    }

    const links = await this.prisma.orgOfficer.findMany({
      where: { userId: user.id, organization: { collegeId, isActive: true } },
      select: { organization: { select: { id: true, name: true, type: true } } },
    });
    return links.map((l) => l.organization);
  }

  async create(user: AuthUser, dto: CreateAnnouncementDto) {
    const collegeId = this.requireCollege(user);
    await this.assertCanManageOrg(user, dto.organizationId, true);

    const row = await this.prisma.announcement.create({
      data: {
        organizationId: dto.organizationId,
        authorId: user.id,
        title: dto.title,
        body: dto.body,
      },
      select: FEED_SELECT,
    });
    await this.invalidate(collegeId);
    return row;
  }

  async update(user: AuthUser, id: string, dto: UpdateAnnouncementDto) {
    const collegeId = this.requireCollege(user);
    const existing = await this.getAnnouncement(id);
    await this.assertCanManageOrg(user, existing.organizationId, false);

    const row = await this.prisma.announcement.update({
      where: { id },
      data: { title: dto.title, body: dto.body },
      select: FEED_SELECT,
    });
    await this.invalidate(collegeId);
    return row;
  }

  async remove(user: AuthUser, id: string) {
    const collegeId = this.requireCollege(user);
    const existing = await this.getAnnouncement(id);
    await this.assertCanManageOrg(user, existing.organizationId, false);

    await this.prisma.announcement.delete({ where: { id } });
    await this.invalidate(collegeId);
    return { message: 'Announcement deleted' };
  }

  // --- helpers ---

  private requireCollege(user: AuthUser): string {
    if (!user.collegeId) {
      throw new ForbiddenException('Finish your registration to choose a college');
    }
    return user.collegeId;
  }

  private async getAnnouncement(id: string) {
    const row = await this.prisma.announcement.findUnique({
      where: { id },
      select: { id: true, organizationId: true },
    });
    if (!row) throw new NotFoundException('Announcement not found');
    return row;
  }

  /**
   * LSG Admin: any organization of their college.
   * Officer: only organizations they were assigned to.
   */
  private async assertCanManageOrg(
    user: AuthUser,
    organizationId: string,
    requireActive: boolean,
  ) {
    const collegeId = this.requireCollege(user);
    const org = await this.prisma.organization.findFirst({
      where: { id: organizationId, collegeId },
    });
    if (!org) throw new NotFoundException('Organization not found');
    if (requireActive && !org.isActive) {
      throw new BadRequestException('This organization is deactivated');
    }
    if (user.role === Role.LSG_ADMIN) return org;

    const link = await this.prisma.orgOfficer.findUnique({
      where: { userId_organizationId: { userId: user.id, organizationId } },
    });
    if (!link) {
      throw new ForbiddenException('You are not an officer of this organization');
    }
    return org;
  }

  /** Clear the cached feed whenever announcements change. */
  private async invalidate(collegeId: string) {
    await this.cache.del(feedKey(collegeId));
    this.logger.log(`cache CLEARED ${feedKey(collegeId)}`);
  }
}