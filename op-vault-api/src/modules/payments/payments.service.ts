import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SaleStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(private prisma: PrismaService, private audit: ActivityLogsService) {}

  /** Recompute a sale's payment status from amountPaid vs grandTotal. */
  static deriveStatus(amountPaid: number, grandTotal: number): SaleStatus {
    if (amountPaid <= 0) return 'UNPAID';
    if (amountPaid >= grandTotal) return 'PAID';
    return 'PARTIAL';
  }

  async findForSale(saleId: string) {
    const sale = await this.prisma.sale.findUnique({ where: { id: saleId } });
    if (!sale) throw new NotFoundException('Sale not found');
    const payments = await this.prisma.payment.findMany({
      where: { saleId }, orderBy: { createdAt: 'asc' },
    });
    const grandTotal = Number(sale.grandTotal);
    const amountPaid = Number(sale.amountPaid);
    return {
      saleId,
      grandTotal,
      amountPaid,
      remainingBalance: Math.max(0, grandTotal - amountPaid),
      status: sale.status,
      payments,
    };
  }

  /** Record an additional payment and re-derive sale status atomically. */
  async addPayment(saleId: string, dto: CreatePaymentDto, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({ where: { id: saleId } });
      if (!sale) throw new NotFoundException('Sale not found');
      if (sale.status === 'CANCELLED' || sale.status === 'REFUNDED') {
        throw new BadRequestException(`Cannot add payment to a ${sale.status} sale`);
      }
      const grandTotal = Number(sale.grandTotal);
      const newPaid = Number(sale.amountPaid) + dto.amount;
      if (newPaid > grandTotal + 0.001) {
        throw new BadRequestException(
          `Payment exceeds remaining balance (${(grandTotal - Number(sale.amountPaid)).toFixed(2)})`,
        );
      }
      await tx.payment.create({
        data: { saleId, amount: dto.amount, method: dto.method, note: dto.note, userId },
      });
      const status = PaymentsService.deriveStatus(newPaid, grandTotal);
      const updated = await tx.sale.update({
        where: { id: saleId },
        data: { amountPaid: new Prisma.Decimal(newPaid), status },
      });
      await this.audit.log(
        { userId, action: 'payment.add', entityType: 'Sale', entityId: saleId,
          metadata: { amount: dto.amount, method: dto.method, newStatus: status } },
        tx,
      );
      return {
        saleId,
        amountPaid: newPaid,
        remainingBalance: Math.max(0, grandTotal - newPaid),
        status: updated.status,
      };
    });
  }
}
