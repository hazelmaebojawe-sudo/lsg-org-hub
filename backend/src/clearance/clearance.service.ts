import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ClearanceStatus, OrgType, PaymentStatus, Role } from '@prisma/client';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { SCHOOL_YEAR, SEMESTERS } from './dto/clearance.dto';

type AuthUser = { id: string; role: Role; collegeId: string | null };

/** "1st Semester" + "2025-2026" -> "1st Semester 2025-2026" (validated). */
function periodLabel(semester: string, schoolYear: string): string {
  if (!SEMESTERS.includes(semester) || !SCHOOL_YEAR.test(schoolYear)) {
    throw new BadRequestException('Choose a valid semester and school year');
  }
  return `${semester} ${schoolYear}`;
}

@Injectable()
export class ClearanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  private requireCollege(user: AuthUser): string {
    if (!user.collegeId) {
      throw new ForbiddenException('Your account has no college assigned');
    }
    return user.collegeId;
  }

  /** The mandatory fees: active fee items of the college's LSG for that semester. */
  private requiredFees(collegeId: string, semester: string, schoolYear: string) {
    return this.prisma.feeItem.findMany({
      where: {
        isActive: true,
        semester,
        schoolYear,
        organization: { collegeId, type: OrgType.LSG, isActive: true },
      },
      select: { id: true },
    });
  }

  /** LSG Admin review screen: every student of the college, who paid, who is cleared. */
  async candidates(admin: AuthUser, semester: string, schoolYear: string) {
    const collegeId = this.requireCollege(admin);
    const label = periodLabel(semester, schoolYear);
    const fees = await this.requiredFees(collegeId, semester, schoolYear);
    const feeIds = fees.map((f) => f.id);

    const users = await this.prisma.user.findMany({
      where: {
        collegeId,
        isActive: true,
        role: { in: [Role.STUDENT, Role.OFFICER] },
      },
      orderBy: { fullName: 'asc' },
      select: {
        id: true,
        fullName: true,
        email: true,
        payments: {
          where: { status: PaymentStatus.PAID, feeItemId: { in: feeIds } },
          select: { feeItemId: true },
        },
        clearances: {
          where: { collegeId, semester: label },
          select: { id: true, status: true },
        },
      },
    });

    return {
      requiredFees: fees.length,
      students: users.map((u) => {
        const paidFees = new Set(u.payments.map((p) => p.feeItemId)).size;
        return {
          id: u.id,
          fullName: u.fullName,
          email: u.email,
          paidFees,
          eligible: fees.length > 0 && paidFees === fees.length,
          clearance: u.clearances[0] ?? null,
        };
      }),
    };
  }

  /** Issue the final college clearance (status: CLEARED). */
  async issue(admin: AuthUser, userId: string, semester: string, schoolYear: string) {
    const collegeId = this.requireCollege(admin);
    const label = periodLabel(semester, schoolYear);

    const student = await this.prisma.user.findFirst({
      where: {
        id: userId,
        collegeId,
        isActive: true,
        role: { in: [Role.STUDENT, Role.OFFICER] },
      },
      select: { id: true, fullName: true, email: true },
    });
    if (!student) throw new NotFoundException('Student not found in your college');

    const fees = await this.requiredFees(collegeId, semester, schoolYear);
    if (fees.length === 0) {
      throw new BadRequestException('No LSG fees were set for this semester');
    }
    const paid = await this.prisma.payment.findMany({
      where: {
        userId: student.id,
        status: PaymentStatus.PAID,
        feeItemId: { in: fees.map((f) => f.id) },
      },
      select: { feeItemId: true },
      distinct: ['feeItemId'],
    });
    if (paid.length < fees.length) {
      throw new BadRequestException('The student has not paid all LSG fees for this semester');
    }

    const existing = await this.prisma.clearance.findFirst({
      where: { userId: student.id, collegeId, semester: label },
    });
    if (existing?.status === ClearanceStatus.CLEARED) {
      throw new ConflictException('This student is already cleared');
    }

    const row = existing
      ? await this.prisma.clearance.update({
          where: { id: existing.id },
          data: {
            status: ClearanceStatus.CLEARED,
            issuedById: admin.id,
            issuedAt: new Date(),
          },
          select: { id: true, status: true },
        })
      : await this.prisma.clearance.create({
          data: {
            userId: student.id,
            collegeId,
            semester: label,
            status: ClearanceStatus.CLEARED,
            issuedById: admin.id,
          },
          select: { id: true, status: true },
        });

    void this.mail.clearanceIssued({
      to: student.email,
      name: student.fullName,
      period: label,
    });
    return row;
  }

  /** Revoke a clearance (status: REVOKED). */
  async revoke(admin: AuthUser, id: string) {
    const collegeId = this.requireCollege(admin);
    const clearance = await this.prisma.clearance.findFirst({ where: { id, collegeId } });
    if (!clearance) throw new NotFoundException('Clearance not found');
    if (clearance.status === ClearanceStatus.REVOKED) {
      throw new ConflictException('This clearance is already revoked');
    }
    return this.prisma.clearance.update({
      where: { id },
      data: { status: ClearanceStatus.REVOKED, issuedById: admin.id },
      select: { id: true, status: true },
    });
  }

  mine(user: AuthUser) {
    return this.prisma.clearance.findMany({
      where: { userId: user.id },
      orderBy: { issuedAt: 'desc' },
      select: { id: true, semester: true, status: true, issuedAt: true },
    });
  }
}