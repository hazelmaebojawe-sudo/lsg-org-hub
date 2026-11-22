import { Injectable, Logger } from '@nestjs/common';
import nodemailer from 'nodemailer';

// Everything put into an email is escaped (XSS prevention)
const esc = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const peso = (centavos: number) =>
  `PHP ${(centavos / 100).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const layout = (title: string, body: string) => `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;border:1px solid #e5e5e5;border-radius:8px">
    <h2 style="margin-top:0">${esc(title)}</h2>
    ${body}
    <p style="color:#888;font-size:12px;margin-top:24px">LSG Org Hub - Caraga State University</p>
  </div>`;

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  // Gmail SMTP with an App Password (credentials come from .env)
  private readonly transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_APP_PASSWORD },
  });

  /** Never throws: an email problem must not break the payment or review. */
  private async send(
    to: string,
    subject: string,
    html: string,
    attachments?: { filename: string; content: Buffer }[],
  ) {
    if (!process.env.SMTP_USER || !process.env.SMTP_APP_PASSWORD) {
      this.logger.warn(`Email not configured, skipped: ${subject}`);
      return;
    }
    try {
      await this.transporter.sendMail({
        from: `"LSG Org Hub" <${process.env.SMTP_USER}>`,
        to,
        subject,
        html,
        attachments,
      });
      this.logger.log(`Email sent: ${subject}`);
    } catch (err) {
      this.logger.error(`Email failed (${subject}): ${(err as Error).message}`);
    }
  }

  membershipDecision(d: {
    to: string;
    name: string;
    organization: string;
    decision: 'VERIFIED' | 'REJECTED';
    remarks?: string;
  }) {
    const approved = d.decision === 'VERIFIED';
    return this.send(
      d.to,
      approved ? 'Your membership was approved' : 'Your membership application was not approved',
      layout(
        approved ? 'Membership approved' : 'Application not approved',
        `<p>Hi ${esc(d.name)},</p>
         <p>${
           approved
             ? `Your application to <b>${esc(d.organization)}</b> was approved. Welcome!`
             : `Your application to <b>${esc(d.organization)}</b> was not approved.`
         }</p>
         ${d.remarks ? `<p>Remarks: ${esc(d.remarks)}</p>` : ''}`,
      ),
    );
  }

  paymentReceipt(d: {
    to: string;
    name: string;
    feeName: string;
    organization: string;
    amountCentavos: number;
    receiptNo: string;
    pdf: Buffer;
  }) {
    return this.send(
      d.to,
      `Payment receipt ${d.receiptNo}`,
      layout(
        'Payment received',
        `<p>Hi ${esc(d.name)},</p>
         <p>We received your payment of <b>${esc(peso(d.amountCentavos))}</b> for
         <b>${esc(d.feeName)}</b> (${esc(d.organization)}).</p>
         <p>Receipt no. <b>${esc(d.receiptNo)}</b> is attached.</p>`,
      ),
      [{ filename: `${d.receiptNo}.pdf`, content: d.pdf }],
    );
  }

  clearanceIssued(d: { to: string; name: string; period: string }) {
    return this.send(
      d.to,
      'Your college clearance was released',
      layout(
        'Clearance released',
        `<p>Hi ${esc(d.name)},</p>
         <p>Your college clearance for <b>${esc(d.period)}</b> has been released by the LSG.</p>`,
      ),
    );
  }
}