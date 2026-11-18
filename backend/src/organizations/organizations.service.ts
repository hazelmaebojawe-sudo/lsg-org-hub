import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { OrgType } from '@prisma/client';
import type { Cache } from 'cache-manager';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateOrganizationDto,
  UpdateOrganizationDto,
} from './dto/organization.dto';

const CACHE_TTL_MS = 5 * 60 * 1000; // cached data expires after 5 minutes
const cacheKey = (collegeId: string) => `orgs:college:${collegeId}`;

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  /** Active organizations of one college (cached). Everyone in that college can read this. */
  async listForCollege(collegeId: string) {
    const key = cacheKey(collegeId);
    const cached = await this.cache.get<unknown[]>(key);
    if (cached) {
      this.logger.log(`cache HIT  ${key}`);
      return cached;
    }

    this.logger.log(`cache MISS ${key} -> reading database`);
    const orgs = await this.prisma.organization.findMany({
      where: { collegeId, isActive: true },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, description: true, logoUrl: true, type: true },
    });
    await this.cache.set(key, orgs, CACHE_TTL_MS);
    return orgs;
  }

  /** LSG Admin view: everything in the college, including deactivated (not cached). */
  listAll(collegeId: string) {
    return this.prisma.organization.findMany({
      where: { collegeId },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
  }

  async create(collegeId: string, dto: CreateOrganizationDto) {
    await this.assertUniqueName(collegeId, dto.name);
    const org = await this.prisma.organization.create({
      data: {
        collegeId,
        name: dto.name,
        description: dto.description,
        type: OrgType.ORG,
      },
    });
    await this.invalidate(collegeId);
    return org;
  }

  async update(collegeId: string, id: string, dto: UpdateOrganizationDto) {
    const org = await this.getOwned(collegeId, id);
    if (dto.isActive === false && org.type === OrgType.LSG) {
      throw new BadRequestException('The LSG organization cannot be deactivated');
    }
    if (dto.name && dto.name.toLowerCase() !== org.name.toLowerCase()) {
      await this.assertUniqueName(collegeId, dto.name, id);
    }
    const updated = await this.prisma.organization.update({
      where: { id },
      data: dto,
    });
    await this.invalidate(collegeId);
    return updated;
  }

  /** Deactivate (soft delete): hidden from students, history is kept. */
  async deactivate(collegeId: string, id: string) {
    const org = await this.getOwned(collegeId, id);
    if (org.type === OrgType.LSG) {
      throw new BadRequestException('The LSG organization cannot be deactivated');
    }
    await this.prisma.organization.update({
      where: { id },
      data: { isActive: false },
    });
    await this.invalidate(collegeId);
    return { message: 'Organization deactivated' };
  }

  // --- helpers ---

  /** Only organizations of the admin's OWN college can be touched. */
  private async getOwned(collegeId: string, id: string) {
    const org = await this.prisma.organization.findFirst({
      where: { id, collegeId },
    });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  private async assertUniqueName(collegeId: string, name: string, excludeId?: string) {
    const clash = await this.prisma.organization.findFirst({
      where: {
        collegeId,
        name: { equals: name, mode: 'insensitive' },
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });
    if (clash) {
      throw new ConflictException('An organization with this name already exists');
    }
  }

    /** Clear the cached lists whenever organizations change. */
  private async invalidate(collegeId: string) {
    await this.cache.del(cacheKey(collegeId));
    await this.cache.del(`announcements:college:${collegeId}`); // the feed shows org names and status
    this.logger.log(`cache CLEARED ${cacheKey(collegeId)}`);
  }
}
