import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MembershipStatus,
  OrgType,
  PaymentStatus,
  Prisma,
  Role,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFeeDto, toCentavos } from './dto/fee.dto';

type AuthUser = { id: string; role: Role; collegeId: string | null };

const FEE_SELECT = {
  id: true,
  name: true,
  amountCentavos: true,
  semester: true,
  schoolYear: true,
  isActive: true,
} as const;

/** LSG fees: every student of the college. Org dues: only VERIFIED members of that organization. */
const payableWhere = (collegeId: string, userId: string): Prisma.FeeItemWhereInput => ({
  isActive: true,
  organization: {
    collegeId,
    isActive: true,
    OR: [
      { type: OrgType.LSG },
      { memberships: { some: { userId, status: MembershipStatus.VERIFIED } } },
    ],
  },
});

@Injectable()
export class FeesService {
  constructor(private readonly prisma: PrismaService) {}

  private requireCollege(user: AuthUser): string {
    if (!user.collegeId) {
      throw new ForbiddenException('Finish your registration to choose a college');
    }
    return user.collegeId;
  }

  /** LSG Admin: any organization of their college. Officer: only their own. */
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

  async create(user: AuthUser, dto: CreateFeeDto) {
    const org = await this.assertManagesOrg(user, dto.organizationId);
    if (!org.isActive) throw new BadRequestException('This organization is deactivated');

    const amountCentavos = toCentavos(dto.amount);
    if (amountCentavos < 2000) {
      throw new BadRequestException('Amount must be at least 20.00');
    }
    return this.prisma.feeItem.create({
      data: {
        organizationId: dto.organizationId,
        name: dto.name,
        amountCentavos,
        semester: dto.semester,
        schoolYear: dto.schoolYear,
      },
      select: FEE_SELECT,
    });
  }

  /** Officer view: fee items with how many paid and how much was collected. */
  async listForOrg(user: AuthUser, orgId: string) {
    await this.assertManagesOrg(user, orgId);
    const items = await this.prisma.feeItem.findMany({
      where: { organizationId: orgId },
      orderBy: [{ schoolYear: 'desc' }, { semester: 'asc' }, { name: 'asc' }],
      select: FEE_SELECT,
    });
    const paid = await this.prisma.payment.groupBy({
      by: ['feeItemId'],
      where: { status: PaymentStatus.PAID, feeItem: { organizationId: orgId } },
      _count: { _all: true },
      _sum: { amountCentavos: true },
    });
    return items.map((item) => {
      const p = paid.find((x) => x.feeItemId === item.id);
      return {
        ...item,
        paidCount: p?._count._all ?? 0,
        collectedCentavos: p?._sum.amountCentavos ?? 0,
      };
    });
  }

  /** Unused fee items can be removed. */
  async remove(user: AuthUser, feeId: string) {
    const fee = await this.prisma.feeItem.findUnique({
      where: { id: feeId },
      select: { id: true, organizationId: true },
    });
    if (!fee) throw new NotFoundException('Fee not found');
    await this.assertManagesOrg(user, fee.organizationId);

    const used = await this.prisma.payment.count({ where: { feeItemId: feeId } });
    if (used > 0) {
      throw new ConflictException('This fee already has payments and cannot be removed');
    }
    await this.prisma.feeItem.delete({ where: { id: feeId } });
    return { message: 'Fee removed' };
  }

  /** Student view: the fees they may pay, and whether they already paid. */
  async listPayable(user: AuthUser) {
    const collegeId = this.requireCollege(user);
    const fees = await this.prisma.feeItem.findMany({
      where: payableWhere(collegeId, user.id),
      orderBy: [{ schoolYear: 'desc' }, { semester: 'asc' }, { name: 'asc' }],
      select: {
        ...FEE_SELECT,
        organization: { select: { id: true, name: true, type: true } },
        payments: {
          where: { userId: user.id, status: PaymentStatus.PAID },
          select: { id: true },
        },
      },
    });
    return fees.map(({ payments, ...fee }) => ({ ...fee, paid: payments.length > 0 }));
  }

  /** One payable fee, or 404 (used when a student starts a checkout). */
  async getPayable(user: AuthUser, feeId: string) {
    const collegeId = this.requireCollege(user);
    const fee = await this.prisma.feeItem.findFirst({
      where: { id: feeId, ...payableWhere(collegeId, user.id) },
      select: {
        ...FEE_SELECT,
        organization: { select: { id: true, name: true, type: true } },
      },
    });
    if (!fee) throw new NotFoundException('Fee not found, or you cannot pay it');
    return fee;
  }
}