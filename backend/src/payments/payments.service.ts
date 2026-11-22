import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PaymentStatus, Prisma, Role } from '@prisma/client';
import { randomBytes } from 'crypto';
import { FeesService } from '../fees/fees.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { PaymongoService } from './paymongo.service';
import { buildReceiptPdf } from './receipt-pdf';
import { XenditService } from './xendit.service';

type AuthUser = { id: string; role: Role; collegeId: string | null };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PAYMENT_INCLUDE = {
  receipt: { select: { id: true } },
  user: {
    select: { fullName: true, email: true, college: { select: { name: true } } },
  },
  feeItem: {
    select: {
      name: true,
      semester: true,
      schoolYear: true,
      organization: { select: { name: true } },
    },
  },
} as const;

type PaymentWithDetails = Prisma.PaymentGetPayload<{ include: typeof PAYMENT_INCLUDE }>;

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fees: FeesService,
    private readonly paymongo: PaymongoService,
    private readonly xendit: XenditService,
    private readonly storage: StorageService,
    private readonly mail: MailService,
  ) {}

  private get provider(): 'xendit' | 'paymongo' {
    return process.env.PAYMENT_PROVIDER === 'paymongo' ? 'paymongo' : 'xendit';
  }

  /** Student starts a payment. The amount always comes from the database. */
  async checkout(user: AuthUser, feeItemId: string) {
    const fee = await this.fees.getPayable(user, feeItemId);

    const already = await this.prisma.payment.findFirst({
      where: { userId: user.id, feeItemId, status: PaymentStatus.PAID },
    });
    if (already) throw new ConflictException('You already paid this fee');

    const payment = await this.prisma.payment.create({
      data: { userId: user.id, feeItemId, amountCentavos: fee.amountCentavos },
    });

    const front = process.env.FRONTEND_URL;
    const description = `${fee.organization.name} - ${fee.semester} ${fee.schoolYear}`;
    const successUrl = `${front}/payments/result?payment=${payment.id}`;
    const cancelUrl = `${front}/dashboard`;

    try {
      const session =
        this.provider === 'xendit'
          ? await this.xendit.createInvoice({
              externalId: payment.id,
              amountCentavos: fee.amountCentavos,
              description: `${fee.name}: ${description}`,
              successUrl,
              failureUrl: cancelUrl,
            })
          : await this.paymongo.createCheckout({
              amountCentavos: fee.amountCentavos,
              name: fee.name,
              description,
              successUrl,
              cancelUrl,
              paymentId: payment.id,
            });

      // The column name says "paymongo", but it holds the checkout/invoice id of either provider
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { paymongoCheckoutId: session.id },
      });
      return { paymentId: payment.id, checkoutUrl: session.checkoutUrl };
    } catch (err) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.FAILED },
      });
      throw err;
    }
  }

  // ---------- webhooks: the ONLY place a payment becomes PAID ----------

  /** Xendit invoice callback. Protected by the x-callback-token header. */
  async handleXenditWebhook(body: Record<string, unknown>, token?: string) {
    if (!this.xendit.verifyCallbackToken(token)) {
      throw new UnauthorizedException('Invalid callback token');
    }

    const status = String(body.status ?? '');
    if (status !== 'PAID' && status !== 'SETTLED') return; // pending or expired: nothing to do

    const externalId = typeof body.external_id === 'string' ? body.external_id : '';
    if (!UUID.test(externalId)) return;

    const payment = await this.prisma.payment.findUnique({
      where: { id: externalId },
      include: PAYMENT_INCLUDE,
    });
    if (!payment) {
      this.logger.warn(`Xendit callback for unknown payment ${externalId}`);
      return;
    }

    // Never trust a payment whose amount differs from what we charged
    const amount = Number(body.amount ?? body.paid_amount);
    if (!Number.isNaN(amount) && Math.round(amount * 100) !== payment.amountCentavos) {
      this.logger.error(
        `Amount mismatch for payment ${payment.id}: got ${amount}, expected ${payment.amountCentavos / 100}`,
      );
      return;
    }

    await this.finalize(payment, typeof body.id === 'string' ? body.id : undefined);
  }

  /** PayMongo webhook. Protected by the signature check. */
  async handlePaymongoWebhook(rawBody: string, signature?: string) {
    if (!this.paymongo.verifySignature(rawBody, signature)) {
      throw new UnauthorizedException('Invalid signature');
    }

    let event: any;
    try {
      event = JSON.parse(rawBody);
    } catch {
      throw new BadRequestException('Invalid payload');
    }

    const attrs = event?.data?.attributes;
    if (attrs?.type !== 'checkout_session.payment.paid') return;

    const checkoutId: string | undefined = attrs.data?.id;
    const paid = attrs.data?.attributes?.payments?.[0];
    if (!checkoutId) return;

    const payment = await this.prisma.payment.findUnique({
      where: { paymongoCheckoutId: checkoutId },
      include: PAYMENT_INCLUDE,
    });
    if (!payment) {
      this.logger.warn(`PayMongo webhook for unknown checkout ${checkoutId}`);
      return;
    }
    const paidAmount = paid?.attributes?.amount;
    if (typeof paidAmount === 'number' && paidAmount !== payment.amountCentavos) {
      this.logger.error(`Amount mismatch for payment ${payment.id}`);
      return;
    }
    await this.finalize(payment, paid?.id);
  }

  /** Marks a payment PAID, creates the PDF receipt in object storage, and emails it. */
  private async finalize(payment: PaymentWithDetails, providerPaymentId?: string) {
    if (payment.status === PaymentStatus.PAID && payment.receipt) return; // already handled

    const paidAt = payment.paidAt ?? new Date();
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.PAID,
        paidAt,
        paymongoPaymentId: providerPaymentId ?? payment.paymongoPaymentId,
      },
    });
    if (payment.receipt) return;

    const ymd = paidAt.toISOString().slice(0, 10).replace(/-/g, '');
    const receiptNo = `OR-${ymd}-${randomBytes(3).toString('hex').toUpperCase()}`;
    const pdf = await buildReceiptPdf({
      receiptNo,
      paidAt,
      studentName: payment.user.fullName,
      studentEmail: payment.user.email,
      college: payment.user.college?.name ?? '',
      organization: payment.feeItem.organization.name,
      feeName: payment.feeItem.name,
      period: `${payment.feeItem.semester} ${payment.feeItem.schoolYear}`,
      amountCentavos: payment.amountCentavos,
      reference: providerPaymentId ?? payment.paymongoCheckoutId ?? payment.id,
    });

    // Only the object key is stored in the database (in receiptUrl)
    const key = `receipts/${payment.id}.pdf`;
    await this.storage.remove(key); // safe if a retry already uploaded it
    await this.storage.upload(key, pdf, 'application/pdf');
    await this.prisma.receipt.create({
      data: { paymentId: payment.id, receiptNo, receiptUrl: key },
    });
    this.logger.log(`Payment ${payment.id} marked PAID, receipt ${receiptNo}`);

    void this.mail.paymentReceipt({
      to: payment.user.email,
      name: payment.user.fullName,
      feeName: payment.feeItem.name,
      organization: payment.feeItem.organization.name,
      amountCentavos: payment.amountCentavos,
      receiptNo,
      pdf,
    });
  }

  // ---------- reads ----------

  async get(user: AuthUser, id: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id, userId: user.id },
      select: {
        id: true,
        status: true,
        amountCentavos: true,
        paidAt: true,
        receipt: { select: { receiptNo: true } },
      },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }

  listMine(user: AuthUser) {
    return this.prisma.payment.findMany({
      where: { userId: user.id, status: PaymentStatus.PAID },
      orderBy: { paidAt: { sort: 'desc', nulls: 'last' } },
      select: {
        id: true,
        amountCentavos: true,
        paidAt: true,
        feeItem: {
          select: {
            name: true,
            semester: true,
            schoolYear: true,
            organization: { select: { name: true } },
          },
        },
        receipt: { select: { receiptNo: true } },
      },
    });
  }

  /** LSG Admin: paid payments of their college. */
  listCollege(user: AuthUser) {
    if (!user.collegeId) {
      throw new ForbiddenException('Your account has no college assigned');
    }
    return this.prisma.payment.findMany({
      where: { status: PaymentStatus.PAID, user: { collegeId: user.collegeId } },
      orderBy: { paidAt: { sort: 'desc', nulls: 'last' } },
      take: 200,
      select: {
        id: true,
        amountCentavos: true,
        paidAt: true,
        user: { select: { fullName: true, email: true } },
        feeItem: {
          select: {
            name: true,
            semester: true,
            schoolYear: true,
            organization: { select: { name: true } },
          },
        },
      },
    });
  }

  /** Signed link to the receipt PDF: its owner, or the LSG Admin of that college. */
  async receiptLink(user: AuthUser, paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      select: {
        userId: true,
        user: { select: { collegeId: true } },
        receipt: { select: { receiptUrl: true } },
      },
    });
    if (!payment?.receipt?.receiptUrl) throw new NotFoundException('Receipt not found');

    const isOwner = payment.userId === user.id;
    const isCollegeAdmin =
      user.role === Role.LSG_ADMIN &&
      !!user.collegeId &&
      payment.user.collegeId === user.collegeId;
    if (!isOwner && !isCollegeAdmin) throw new ForbiddenException('Not allowed');

    return { url: await this.storage.signedUrl(payment.receipt.receiptUrl) };
  }
}