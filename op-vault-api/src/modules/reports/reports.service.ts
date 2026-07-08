import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import PDFDocument = require('pdfkit');
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';

type Col = { header: string; width: number; align?: 'left' | 'right' };
const n = (v: any) => (v == null ? 0 : Number(v));

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService, private settings: SettingsService) {}

  private async header(doc: PDFKit.PDFDocument, title: string) {
    const store = await this.settings.get<string>('storeName');
    doc.fontSize(18).fillColor('#111111').text(store, { continued: false });
    doc.fontSize(13).fillColor('#666666').text(title);
    doc.fontSize(9).fillColor('#999999')
      .text(`Generated ${new Date().toLocaleString('en-PH')}`);
    doc.moveDown(0.8);
    doc.strokeColor('#CCCCCC').moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(0.6);
  }

  private table(doc: PDFKit.PDFDocument, cols: Col[], rows: (string | number)[][]) {
    const startX = 40;
    let y = doc.y;
    const rowH = 20;
    const draw = (cells: (string | number)[], bold: boolean) => {
      let x = startX;
      doc.fontSize(9).fillColor(bold ? '#111111' : '#333333').font(bold ? 'Helvetica-Bold' : 'Helvetica');
      cols.forEach((c, i) => {
        doc.text(String(cells[i] ?? ''), x + 2, y + 5, { width: c.width - 4, align: c.align ?? 'left', lineBreak: false });
        x += c.width;
      });
      y += rowH;
    };
    // header row
    doc.rect(startX, y, cols.reduce((a, c) => a + c.width, 0), rowH).fill('#F5F5F5');
    draw(cols.map((c) => c.header), true);
    // body
    rows.forEach((r, idx) => {
      if (y > 760) { doc.addPage(); y = 40; }
      if (idx % 2 === 1) doc.rect(startX, y, cols.reduce((a, c) => a + c.width, 0), rowH).fill('#FAFAFA');
      draw(r, false);
    });
    doc.font('Helvetica').fillColor('#111111');
    doc.y = y + 8;
  }

  private async stream(res: Response, filename: string, build: (doc: PDFKit.PDFDocument) => Promise<void>) {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    doc.pipe(res);
    await build(doc);
    doc.end();
  }

  async inventory(res: Response) {
    const cards = await this.prisma.rawCard.findMany({ orderBy: { name: 'asc' } });
    const slabs = await this.prisma.slabCard.findMany({ where: { status: { not: 'SOLD' } }, orderBy: { name: 'asc' } });
    const totalValue = cards.reduce((a, c) => a + n(c.buyCost) * c.quantity, 0)
      + slabs.reduce((a, s) => a + n(s.buyCost), 0);
    await this.stream(res, 'inventory-report.pdf', async (doc) => {
      await this.header(doc, 'Inventory Report');
      doc.fontSize(11).fillColor('#111').text('Raw Cards', { underline: false }).moveDown(0.3);
      this.table(doc,
        [{ header: 'Name', width: 150 }, { header: 'No.', width: 70 }, { header: 'Rarity', width: 55 },
         { header: 'Qty', width: 40, align: 'right' }, { header: 'Cost', width: 70, align: 'right' },
         { header: 'Price', width: 70, align: 'right' }, { header: 'Status', width: 60 }],
        cards.map((c) => [c.name, c.cardNumber, c.rarity, c.quantity, n(c.buyCost).toFixed(2), n(c.postedPrice).toFixed(2), c.status]));
      doc.moveDown(0.6).fontSize(11).text('Slabs').moveDown(0.3);
      this.table(doc,
        [{ header: 'Name', width: 170 }, { header: 'Company', width: 70 }, { header: 'Cert', width: 90 },
         { header: 'Grade', width: 50, align: 'right' }, { header: 'Cost', width: 70, align: 'right' }, { header: 'Price', width: 70, align: 'right' }],
        slabs.map((s) => [s.name, s.gradingCompany, s.slabNumber, n(s.grade), n(s.buyCost).toFixed(2), n(s.sellPrice).toFixed(2)]));
      doc.moveDown(0.6).fontSize(11).font('Helvetica-Bold').text(`Total inventory value: PHP ${totalValue.toFixed(2)}`);
    });
  }

  async sales(res: Response) {
    const sales = await this.prisma.sale.findMany({
      where: { status: { notIn: ['CANCELLED', 'REFUNDED'] } },
      include: { customer: true }, orderBy: { createdAt: 'desc' }, take: 500,
    });
    const total = sales.reduce((a, s) => a + n(s.grandTotal), 0);
    await this.stream(res, 'sales-report.pdf', async (doc) => {
      await this.header(doc, 'Sales Report');
      this.table(doc,
        [{ header: 'Ref', width: 75 }, { header: 'Date', width: 90 }, { header: 'Customer', width: 130 },
         { header: 'Total', width: 75, align: 'right' }, { header: 'Profit', width: 70, align: 'right' }, { header: 'Status', width: 70 }],
        sales.map((s) => [s.reference, new Date(s.createdAt).toLocaleDateString('en-PH'), s.customer.name,
          n(s.grandTotal).toFixed(2), n(s.totalProfit).toFixed(2), s.status]));
      doc.moveDown(0.6).font('Helvetica-Bold').fontSize(11).text(`Total revenue: PHP ${total.toFixed(2)}`);
    });
  }

  async profit(res: Response) {
    const sales = await this.prisma.sale.findMany({ where: { status: { notIn: ['CANCELLED', 'REFUNDED'] } } });
    const revenue = sales.reduce((a, s) => a + n(s.grandTotal), 0);
    const profit = sales.reduce((a, s) => a + n(s.totalProfit), 0);
    const margin = revenue ? (profit / revenue) * 100 : 0;
    await this.stream(res, 'profit-report.pdf', async (doc) => {
      await this.header(doc, 'Profit Report');
      this.table(doc,
        [{ header: 'Metric', width: 260 }, { header: 'Value', width: 200, align: 'right' }],
        [['Total revenue', `PHP ${revenue.toFixed(2)}`], ['Total profit', `PHP ${profit.toFixed(2)}`],
         ['Profit margin', `${margin.toFixed(1)}%`], ['Completed orders', sales.length]]);
    });
  }

  async shipping(res: Response) {
    const shipments = await this.prisma.shipment.findMany({
      include: { sale: { include: { customer: true } } }, orderBy: { createdAt: 'desc' }, take: 500,
    });
    await this.stream(res, 'shipping-report.pdf', async (doc) => {
      await this.header(doc, 'Shipping Report');
      this.table(doc,
        [{ header: 'Customer', width: 130 }, { header: 'Courier', width: 70 }, { header: 'Status', width: 80 },
         { header: 'Tracking', width: 110 }, { header: 'Value', width: 80, align: 'right' }],
        shipments.map((s) => [s.sale.customer.name, s.courier, s.status, s.trackingNumber ?? '—', n(s.totalValue).toFixed(2)]));
    });
  }

  async customers(res: Response) {
    const rows = await this.prisma.$queryRaw<{ name: string; orders: any; spent: any; profit: any }[]>`
      SELECT c.name, COUNT(s.id) AS orders, COALESCE(SUM(s."grandTotal"),0) AS spent, COALESCE(SUM(s."totalProfit"),0) AS profit
      FROM customers c LEFT JOIN sales s ON s."customerId" = c.id AND s.status NOT IN ('CANCELLED','REFUNDED')
      GROUP BY c.name ORDER BY spent DESC`;
    await this.stream(res, 'customer-report.pdf', async (doc) => {
      await this.header(doc, 'Customer Report');
      this.table(doc,
        [{ header: 'Customer', width: 200 }, { header: 'Orders', width: 80, align: 'right' },
         { header: 'Spent', width: 90, align: 'right' }, { header: 'Profit', width: 90, align: 'right' }],
        rows.map((r) => [r.name, n(r.orders), n(r.spent).toFixed(2), n(r.profit).toFixed(2)]));
    });
  }

  async cardPerformance(res: Response) {
    const cards = await this.prisma.rawCard.findMany({ orderBy: { totalSold: 'desc' }, take: 200 });
    await this.stream(res, 'card-performance-report.pdf', async (doc) => {
      await this.header(doc, 'Card Performance Report');
      this.table(doc,
        [{ header: 'Name', width: 160 }, { header: 'Rarity', width: 55 }, { header: 'Sold', width: 50, align: 'right' },
         { header: 'In stock', width: 60, align: 'right' }, { header: 'Avg sell', width: 80, align: 'right' }, { header: 'Price', width: 70, align: 'right' }],
        cards.map((c) => [c.name, c.rarity, c.totalSold, c.quantity, n(c.avgSellPrice).toFixed(2), n(c.postedPrice).toFixed(2)]));
    });
  }
}
