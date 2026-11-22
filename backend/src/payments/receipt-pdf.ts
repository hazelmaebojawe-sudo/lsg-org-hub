import PDFDocument from 'pdfkit';

export type ReceiptData = {
  receiptNo: string;
  paidAt: Date;
  studentName: string;
  studentEmail: string;
  college: string;
  organization: string;
  feeName: string;
  period: string;
  amountCentavos: number;
  reference: string;
};

const peso = (centavos: number) =>
  `PHP ${(centavos / 100).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export function buildReceiptPdf(d: ReceiptData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A5', margin: 40 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).text('OFFICIAL RECEIPT', { align: 'center' });
    doc
      .fontSize(10)
      .fillColor('#555555')
      .text('LSG Org Hub - Caraga State University', { align: 'center' });
    doc.moveDown(1.5).fillColor('#000000');

    const row = (label: string, value: string) => {
      doc.fontSize(9).fillColor('#666666').text(label);
      doc.fontSize(11).fillColor('#000000').text(value).moveDown(0.6);
    };
    row('Receipt no.', d.receiptNo);
    row(
      'Date paid',
      d.paidAt.toLocaleString('en-PH', {
        timeZone: 'Asia/Manila',
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    );
    row('Student', `${d.studentName} (${d.studentEmail})`);
    row('College', d.college);
    row('Organization', d.organization);
    row('Payment for', `${d.feeName} - ${d.period}`);
    row('Amount paid', peso(d.amountCentavos));
    row('Reference', d.reference);

    doc
      .moveDown()
      .fontSize(8)
      .fillColor('#888888')
      .text('Paid online (test mode). This receipt is generated automatically.', {
        align: 'center',
      });
    doc.end();
  });
}