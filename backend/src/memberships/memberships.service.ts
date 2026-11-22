import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MembershipStatus, Role } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { RequirementDto } from './dto/membership.dto';
import type { UploadedFileData } from './upload.types';
import { MailService } from '../mail/mail.service';

type AuthUser = { id: string; role: Role; collegeId: string | null };

// Allowed uploads, checked by type AND by the file's first bytes (a renamed .exe is rejected)
const FILE_RULES: Record<string, { ext: string; magic: number[] }> = {
  'application/pdf': { ext: 'pdf', magic: [0x25, 0x50, 0x44, 0x46] },
  'image/jpeg': { ext: 'jpg', magic: [0xff, 0xd8, 0xff] },
  'image/png': { ext: 'png', magic: [0x89, 0x50, 0x4e, 0x47] },
};

function checkFile(file: UploadedFileData): string {
  const rule = FILE_RULES[file.mimetype];
  if (!rule) throw new BadRequestException('Only PDF, JPG or PNG files are allowed');
  if (!rule.magic.every((byte, i) => file.buffer[i] === byte)) {
    throw new BadRequestException('The file content does not match its type');
  }
  return rule.ext;
}

@Injectable()
export class MembershipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly mail: MailService,
  ) {}

  private requireCollege(user: AuthUser): string {
    if (!user.collegeId) {
      throw new ForbiddenException('Finish your registration to choose a college');
    }
    return user.collegeId;
  }

  /** LSG Admin: any organization of their college. Officer: only their own organizations. */
  private async assertManagesOrg(user: AuthUser, orgId: string) {
    const collegeId = this.requireCollege(user);
    const org = await this.prisma.organization.findFirst({
      where: { id: orgId, collegeId },
    });
    if (!org) throw new NotFoundException('Organization not found');
    if (user.role === Role.LSG_ADMIN) return org;

    const link = await this.prisma.orgOfficer.findUnique({
      where: { userId_organizationId: { userId: user.id, organizationId: orgId } },
    });
    if (!link) throw new ForbiddenException('You are not an officer of this organization');
    return org;
  }

  // ---------- requirements ----------

  async listRequirements(user: AuthUser, orgId: string) {
    const collegeId = this.requireCollege(user);
    const org = await this.prisma.organization.findFirst({
      where: { id: orgId, collegeId, isActive: true },
    });
    if (!org) throw new NotFoundException('Organization not found');
    return this.prisma.membershipRequirement.findMany({
      where: { organizationId: orgId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, description: true },
    });
  }

  async addRequirement(user: AuthUser, orgId: string, dto: RequirementDto) {
    await this.assertManagesOrg(user, orgId);
    return this.prisma.membershipRequirement.create({
      data: { organizationId: orgId, name: dto.name, description: dto.description },
      select: { id: true, name: true, description: true },
    });
  }

  async removeRequirement(user: AuthUser, orgId: string, requirementId: string) {
    await this.assertManagesOrg(user, orgId);
    const requirement = await this.prisma.membershipRequirement.findFirst({
      where: { id: requirementId, organizationId: orgId },
    });
    if (!requirement) throw new NotFoundException('Requirement not found');

    const used = await this.prisma.membershipFile.count({ where: { requirementId } });
    if (used > 0) {
      throw new ConflictException('Students already submitted files for this requirement');
    }
    await this.prisma.membershipRequirement.delete({ where: { id: requirementId } });
    return { message: 'Requirement removed' };
  }

  // ---------- student side ----------

  async apply(user: AuthUser, organizationId: string) {
    const collegeId = this.requireCollege(user);
    // Scope limit: students can only join organizations of THEIR college
    const org = await this.prisma.organization.findFirst({
      where: { id: organizationId, collegeId, isActive: true },
    });
    if (!org) throw new NotFoundException('Organization not found');

    const existing = await this.prisma.membership.findFirst({
      where: {
        userId: user.id,
        organizationId,
        status: { in: [MembershipStatus.PENDING, MembershipStatus.VERIFIED] },
      },
    });
    if (existing) {
      throw new ConflictException(
        existing.status === MembershipStatus.VERIFIED
          ? 'You are already a member'
          : 'You already have a pending application',
      );
    }
    return this.prisma.membership.create({
      data: { userId: user.id, organizationId },
      select: { id: true, status: true },
    });
  }

  listMine(user: AuthUser) {
    return this.prisma.membership.findMany({
      where: { userId: user.id },
      orderBy: { appliedAt: 'desc' },
      select: {
        id: true,
        status: true,
        remarks: true,
        appliedAt: true,
        organization: { select: { id: true, name: true, type: true } },
        files: { select: { id: true, requirementId: true } },
      },
    });
  }

  async uploadFile(
    user: AuthUser,
    membershipId: string,
    requirementId: string,
    file: UploadedFileData,
  ) {
    const ext = checkFile(file);

    const membership = await this.prisma.membership.findFirst({
      where: { id: membershipId, userId: user.id },
    });
    if (!membership) throw new NotFoundException('Application not found');
    if (membership.status !== MembershipStatus.PENDING) {
      throw new BadRequestException('Files can only be changed while the application is pending');
    }
    const requirement = await this.prisma.membershipRequirement.findFirst({
      where: { id: requirementId, organizationId: membership.organizationId },
    });
    if (!requirement) throw new NotFoundException('Requirement not found');

    const key = `memberships/${membershipId}/${requirementId}-${randomUUID()}.${ext}`;
    const stored = await this.storage.upload(key, file.buffer, file.mimetype);

    // One file per requirement: a new upload replaces the old one
    const old = await this.prisma.membershipFile.findFirst({
      where: { membershipId, requirementId },
    });
    const row = old
      ? await this.prisma.membershipFile.update({
          where: { id: old.id },
          data: { fileUrl: stored.url, fileKey: stored.key },
        })
      : await this.prisma.membershipFile.create({
          data: { membershipId, requirementId, fileUrl: stored.url, fileKey: stored.key },
        });
    if (old) await this.storage.remove(old.fileKey);
    return { id: row.id, requirementId };
  }

  async withdraw(user: AuthUser, id: string) {
    const membership = await this.prisma.membership.findFirst({
      where: { id, userId: user.id },
    });
    if (!membership) throw new NotFoundException('Application not found');
    if (membership.status !== MembershipStatus.PENDING) {
      throw new BadRequestException('Only pending applications can be withdrawn');
    }
    await this.prisma.membership.update({
      where: { id },
      data: { status: MembershipStatus.WITHDRAWN },
    });
    return { message: 'Application withdrawn' };
  }

  // ---------- officer / admin side ----------

  async listForOrg(user: AuthUser, orgId: string, status?: string) {
    await this.assertManagesOrg(user, orgId);
    if (status && !(status in MembershipStatus)) {
      throw new BadRequestException('Unknown status');
    }
    return this.prisma.membership.findMany({
      where: {
        organizationId: orgId,
        ...(status ? { status: status as MembershipStatus } : {}),
      },
      orderBy: { appliedAt: 'desc' },
      select: {
        id: true,
        status: true,
        remarks: true,
        appliedAt: true,
        user: { select: { id: true, fullName: true, email: true } },
        files: {
          select: { id: true, requirement: { select: { id: true, name: true } } },
        },
      },
    });
  }

   async review(
    user: AuthUser,
    id: string,
    decision: 'VERIFIED' | 'REJECTED',
    remarks?: string,
  ) {
    const membership = await this.prisma.membership.findUnique({
      where: { id },
      include: {
        user: { select: { fullName: true, email: true } },
        organization: { select: { name: true } },
      },
    });
    if (!membership) throw new NotFoundException('Application not found');
    await this.assertManagesOrg(user, membership.organizationId);

    if (membership.status !== MembershipStatus.PENDING) {
      throw new BadRequestException('This application was already reviewed');
    }

    if (decision === 'VERIFIED') {
      // Verify only when every requirement has a file
      const [required, submitted] = await Promise.all([
        this.prisma.membershipRequirement.findMany({
          where: { organizationId: membership.organizationId },
          select: { id: true },
        }),
        this.prisma.membershipFile.findMany({
          where: { membershipId: id },
          select: { requirementId: true },
        }),
      ]);
      const missing = required.filter(
        (r) => !submitted.some((s) => s.requirementId === r.id),
      );
      if (missing.length > 0) {
        throw new BadRequestException('The student has not submitted all required files');
      }
    }

    const updated = await this.prisma.membership.update({
      where: { id },
      data: {
        status: decision as MembershipStatus,
        remarks: remarks || null,
        verifiedById: user.id,
      },
      select: { id: true, status: true },
    });

    void this.mail.membershipDecision({
      to: membership.user.email,
      name: membership.user.fullName,
      organization: membership.organization.name,
      decision,
      remarks,
    });
    return updated;
  }

  /** Signed link to a file: its owner, or an officer/admin who manages that organization. */
  async fileUrl(user: AuthUser, fileId: string) {
    const file = await this.prisma.membershipFile.findUnique({
      where: { id: fileId },
      select: {
        fileKey: true,
        membership: { select: { userId: true, organizationId: true } },
      },
    });
    if (!file) throw new NotFoundException('File not found');

    if (file.membership.userId !== user.id) {
      if (user.role === Role.STUDENT) throw new ForbiddenException('Not allowed');
      await this.assertManagesOrg(user, file.membership.organizationId);
    }
    return { url: await this.storage.signedUrl(file.fileKey) };
  }
}