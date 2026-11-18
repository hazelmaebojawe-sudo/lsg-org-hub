import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OfficersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Only organizations of the admin's OWN college can be managed. */
  private async getOwnedOrg(collegeId: string, orgId: string) {
    const org = await this.prisma.organization.findFirst({
      where: { id: orgId, collegeId },
    });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async list(collegeId: string, orgId: string) {
    await this.getOwnedOrg(collegeId, orgId);
    const rows = await this.prisma.orgOfficer.findMany({
      where: { organizationId: orgId },
      select: { user: { select: { id: true, fullName: true, email: true } } },
      orderBy: { user: { fullName: 'asc' } },
    });
    return rows.map((r) => r.user);
  }

  async assign(collegeId: string, orgId: string, email: string) {
    const org = await this.getOwnedOrg(collegeId, orgId);
    if (!org.isActive) {
      throw new BadRequestException('This organization is deactivated');
    }

    // Same college, active account: students cannot be picked from other colleges
    const user = await this.prisma.user.findFirst({
      where: { email, collegeId, isActive: true },
    });
    if (!user) {
      throw new NotFoundException(
        'No active member of your college has that email. They must sign in and register first.',
      );
    }
    if (user.role === Role.LSG_ADMIN) {
      throw new BadRequestException('An LSG Admin cannot be assigned as an officer');
    }

    const existing = await this.prisma.orgOfficer.findUnique({
      where: { userId_organizationId: { userId: user.id, organizationId: orgId } },
    });
    if (existing) {
      throw new ConflictException('This person is already an officer here');
    }

    await this.prisma.$transaction([
      this.prisma.orgOfficer.create({
        data: { userId: user.id, organizationId: orgId },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: { role: Role.OFFICER },
      }),
    ]);
    return { id: user.id, fullName: user.fullName, email: user.email };
  }

  async remove(collegeId: string, orgId: string, userId: string) {
    await this.getOwnedOrg(collegeId, orgId);
    const link = await this.prisma.orgOfficer.findUnique({
      where: { userId_organizationId: { userId, organizationId: orgId } },
    });
    if (!link) {
      throw new NotFoundException('This person is not an officer of the organization');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.orgOfficer.delete({ where: { id: link.id } });
      // No officer roles left anywhere? Back to a regular student.
      const remaining = await tx.orgOfficer.count({ where: { userId } });
      if (remaining === 0) {
        await tx.user.updateMany({
          where: { id: userId, role: Role.OFFICER },
          data: { role: Role.STUDENT },
        });
      }
    });
    return { message: 'Officer removed' };
  }
}
