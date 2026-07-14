import {
  BadRequestException, Injectable, NotFoundException,
} from '@nestjs/common';
import { Prisma, StockStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { paginate } from '../../common/dto/pagination.dto';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { PaymentsService } from '../payments/payments.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { QuerySaleDto } from './dto/query-sale.dto';

const LOW_STOCK = 3;
const stockStatus = (q: number): StockStatus => (q <= 0 ? 'OUT' : q <= LOW_STOCK ? 'LOW' : 'AVAILABLE');

@Injectable()
export class SalesService {
  constructor(private prisma: PrismaService, private audit: ActivityLogsService) {}

  // ===================================================================
  // COMPLETE SALE — one atomic transaction. Any failure rolls back all.
  // ===================================================================
  async completeSale(dto: CreateSaleDto, userId: string) {
    if (!dto.customerId && !dto.customer) {
      throw new BadRequestException('Provide either customerId or customer');
    }

    return this.prisma.$transaction(
      async (tx) => {
        // 1. Validate / create customer
        let customerId = dto.customerId;
        if (!customerId) {
          const c = await tx.customer.create({ data: dto.customer! });
          customerId = c.id;
        } else {
          const c = await tx.customer.findUnique({ where: { id: customerId } });
          if (!c) throw new NotFoundException('Customer not found');
        }

        let subtotal = 0;
        let itemsProfit = 0;
        const saleItemsData: Prisma.SaleItemCreateManySaleInput[] = [];
        const shipmentItemsData: { nameSnapshot: string; quantity: number }[] = [];
        // 2. Validate stock/slabs/prices, deduct inventory, snapshot cost & profit
        for (const line of dto.items) {
          const { lineRevenue, lineProfit } = await this.applySaleLine(tx, line, userId, { saleItemsData, shipmentItemsData });
          subtotal += lineRevenue;
          itemsProfit += lineProfit;
        }

        // 3. Totals — discount reduces profit; shipping fee is pass-through (not profit)
        const discount = dto.discount ?? 0;
        const shippingFee = dto.shippingFee ?? 0;
        if (discount > subtotal) throw new BadRequestException('Discount cannot exceed subtotal');
        const grandTotal = subtotal - discount + shippingFee;
        const totalProfit = itemsProfit - discount;
        const amountPaid = Math.min(dto.amountPaid ?? 0, grandTotal);
        const status = PaymentsService.deriveStatus(amountPaid, grandTotal);

        // 4. Human-facing reference
        const count = await tx.sale.count();
        const reference = `SALE-${1001 + count}`;

        // 5. Create Sale + items
        const sale = await tx.sale.create({
          data: {
            reference, customerId, userId,
            subtotal: new Prisma.Decimal(subtotal),
            discount: new Prisma.Decimal(discount),
            shippingFee: new Prisma.Decimal(shippingFee),
            grandTotal: new Prisma.Decimal(grandTotal),
            amountPaid: new Prisma.Decimal(amountPaid),
            totalProfit: new Prisma.Decimal(totalProfit),
            status, notes: dto.notes,
            items: { createMany: { data: saleItemsData } },
          },
        });

        // 6. Initial payment record
        if (amountPaid > 0) {
          await tx.payment.create({
            data: { saleId: sale.id, amount: new Prisma.Decimal(amountPaid), method: dto.paymentMethod, userId },
          });
        }

        // 7. Shipment + items + opening timeline event
        const shipment = await tx.shipment.create({
          data: {
            saleId: sale.id, courier: dto.courier, status: 'TO_PACK',
            shippingFee: new Prisma.Decimal(shippingFee),
            totalValue: new Prisma.Decimal(grandTotal),
            items: { createMany: { data: shipmentItemsData } },
          },
        });
        await tx.shipmentEvent.create({
          data: { shipmentId: shipment.id, status: 'TO_PACK', note: 'Sale completed — queued for packing' },
        });

        // 8. Notification + audit (inside the transaction)
        await tx.notification.create({
          data: { userId, type: 'SALE', title: `New sale ${reference}`, body: `₱${grandTotal.toFixed(2)} · ${status}` },
        });
        await this.audit.log(
          { userId, action: 'sale.complete', entityType: 'Sale', entityId: sale.id,
            metadata: { reference, grandTotal, totalProfit, items: saleItemsData.length } },
          tx,
        );

        return tx.sale.findUnique({
          where: { id: sale.id },
          include: { items: true, payments: true, shipment: { include: { items: true } }, customer: true },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 },
    );
  }

  // Shared per-line logic: validate + deduct inventory for ONE sale line, and
  // push the resulting sale-item + shipment-item snapshots. Used by completeSale
  // and editSaleItems so inventory/profit math lives in exactly one place.
  private async applySaleLine(
    tx: Prisma.TransactionClient,
    line: CreateSaleDto['items'][number],
    userId: string,
    acc: {
      saleItemsData: Prisma.SaleItemCreateManySaleInput[];
      shipmentItemsData: { nameSnapshot: string; quantity: number }[];
    },
  ): Promise<{ lineRevenue: number; lineProfit: number }> {
    if (line.unitPrice < 0) throw new BadRequestException('Unit price cannot be negative');

    if (line.itemType === 'RAW') {
      if (!line.rawCardId) throw new BadRequestException('rawCardId required for RAW item');
      const card = await tx.rawCard.findUnique({ where: { id: line.rawCardId } });
      if (!card) throw new NotFoundException(`Raw card ${line.rawCardId} not found`);
      if (card.quantity < line.quantity) {
        throw new BadRequestException(
          `Insufficient stock for ${card.name}: ${card.quantity} available, ${line.quantity} requested`,
        );
      }
      const unitCost = Number(card.buyCost);
      const lineRevenue = line.unitPrice * line.quantity;
      const lineProfit = (line.unitPrice - unitCost) * line.quantity;
      const newQty = card.quantity - line.quantity;
      const newTotalSold = card.totalSold + line.quantity;
      const prevAvg = Number(card.avgSellPrice ?? 0);
      const newAvg = (prevAvg * card.totalSold + lineRevenue) / newTotalSold;
      await tx.rawCard.update({
        where: { id: card.id },
        data: {
          quantity: newQty,
          status: stockStatus(newQty),
          totalSold: newTotalSold,
          lastSoldAt: new Date(),
          avgSellPrice: new Prisma.Decimal(newAvg.toFixed(2)),
        },
      });
      await tx.inventoryLog.create({
        data: {
          itemType: 'RAW', rawCardId: card.id, action: 'SALE',
          quantityDelta: -line.quantity, quantityAfter: newQty, userId,
        },
      });
      if (newQty <= LOW_STOCK) {
        await tx.notification.create({
          data: {
            type: newQty <= 0 ? 'OUT_OF_STOCK' : 'LOW_STOCK',
            title: newQty <= 0 ? `Out of stock: ${card.name}` : `Low stock: ${card.name}`,
            body: `${newQty} remaining after sale`,
          },
        });
      }
      if (Number(card.postedPrice) !== line.unitPrice) {
        await tx.priceHistory.create({
          data: {
            itemType: 'RAW', itemId: card.id, field: 'salePrice',
            oldValue: card.postedPrice, newValue: new Prisma.Decimal(line.unitPrice),
          },
        });
      }
      acc.saleItemsData.push({
        itemType: 'RAW', rawCardId: card.id, nameSnapshot: card.name,
        quantity: line.quantity, unitPrice: new Prisma.Decimal(line.unitPrice),
        unitCost: new Prisma.Decimal(unitCost), lineProfit: new Prisma.Decimal(lineProfit),
      });
      acc.shipmentItemsData.push({ nameSnapshot: `${card.name} x${line.quantity}`, quantity: line.quantity });
      return { lineRevenue, lineProfit };
    }

    // SLAB — always quantity 1, must be AVAILABLE
    if (!line.slabId) throw new BadRequestException('slabId required for SLAB item');
    const slab = await tx.slabCard.findUnique({ where: { id: line.slabId } });
    if (!slab) throw new NotFoundException(`Slab ${line.slabId} not found`);
    if (slab.status === 'SOLD') throw new BadRequestException(`Slab ${slab.name} is already sold`);
    const unitCost = Number(slab.buyCost);
    const lineProfit = line.unitPrice - unitCost;
    await tx.slabCard.update({
      where: { id: slab.id }, data: { status: 'SOLD', soldAt: new Date() },
    });
    await tx.inventoryLog.create({
      data: {
        itemType: 'SLAB', slabId: slab.id, action: 'SALE',
        quantityDelta: -1, quantityAfter: 0, userId,
      },
    });
    acc.saleItemsData.push({
      itemType: 'SLAB', slabId: slab.id, nameSnapshot: `${slab.name} (${slab.gradingCompany} ${slab.grade})`,
      quantity: 1, unitPrice: new Prisma.Decimal(line.unitPrice),
      unitCost: new Prisma.Decimal(unitCost), lineProfit: new Prisma.Decimal(lineProfit),
    });
    acc.shipmentItemsData.push({ nameSnapshot: `${slab.name} (${slab.gradingCompany} ${slab.grade})`, quantity: 1 });
    return { lineRevenue: line.unitPrice, lineProfit };
  }
  // ===================================================================
  // Reversal helpers (shared by cancel / refund / undo)
  // ===================================================================
  private async restoreInventory(tx: Prisma.TransactionClient, saleId: string, userId: string) {
    const items = await tx.saleItem.findMany({ where: { saleId } });
    for (const it of items) {
      if (it.itemType === 'RAW' && it.rawCardId) {
        const card = await tx.rawCard.findUnique({ where: { id: it.rawCardId } });
        if (card) {
          const newQty = card.quantity + it.quantity;
          await tx.rawCard.update({
            where: { id: card.id },
            data: {
              quantity: newQty,
              status: stockStatus(newQty),
              totalSold: Math.max(0, card.totalSold - it.quantity),
            },
          });
          await tx.inventoryLog.create({
            data: {
              itemType: 'RAW', rawCardId: card.id, action: 'CANCEL_SALE',
              quantityDelta: it.quantity, quantityAfter: newQty, reference: saleId, userId,
            },
          });
        }
      } else if (it.itemType === 'SLAB' && it.slabId) {
        await tx.slabCard.update({ where: { id: it.slabId }, data: { status: 'AVAILABLE', soldAt: null } });
        await tx.inventoryLog.create({
          data: { itemType: 'SLAB', slabId: it.slabId, action: 'CANCEL_SALE', quantityDelta: 1, quantityAfter: 1, reference: saleId, userId },
        });
      }
    }
  }

  private async loadSaleOrThrow(tx: Prisma.TransactionClient, id: string) {
    const sale = await tx.sale.findUnique({ where: { id }, include: { shipment: true } });
    if (!sale) throw new NotFoundException('Sale not found');
    return sale;
  }

  /** CANCEL — keep the record, mark CANCELLED, return inventory, cancel shipment. */
  async cancelSale(id: string, userId: string, reason?: string) {
    return this.prisma.$transaction(async (tx) => {
      const sale = await this.loadSaleOrThrow(tx, id);
      if (sale.status === 'CANCELLED') throw new BadRequestException('Sale is already cancelled');
      if (sale.status === 'REFUNDED') throw new BadRequestException('Sale was refunded');
      await this.restoreInventory(tx, id, userId);
      if (sale.shipment && sale.shipment.status !== 'CANCELLED') {
        await tx.shipment.update({ where: { id: sale.shipment.id }, data: { status: 'CANCELLED' } });
        await tx.shipmentEvent.create({ data: { shipmentId: sale.shipment.id, status: 'CANCELLED', note: reason ?? 'Sale cancelled' } });
      }
      const updated = await tx.sale.update({ where: { id }, data: { status: 'CANCELLED', cancelledAt: new Date(), notes: reason ?? sale.notes } });
      await this.audit.log({ userId, action: 'sale.cancel', entityType: 'Sale', entityId: id, metadata: { reason } }, tx);
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  /** REFUND — money returned; inventory restored; sale marked REFUNDED. */
  async refundSale(id: string, userId: string, reason?: string) {
    return this.prisma.$transaction(async (tx) => {
      const sale = await this.loadSaleOrThrow(tx, id);
      if (sale.status === 'REFUNDED') throw new BadRequestException('Sale is already refunded');
      if (sale.status === 'CANCELLED') throw new BadRequestException('Cancelled sales cannot be refunded');
      await this.restoreInventory(tx, id, userId);
      if (sale.shipment && sale.shipment.status !== 'CANCELLED') {
        await tx.shipment.update({ where: { id: sale.shipment.id }, data: { status: 'CANCELLED' } });
        await tx.shipmentEvent.create({ data: { shipmentId: sale.shipment.id, status: 'CANCELLED', note: reason ?? 'Sale refunded' } });
      }
      const updated = await tx.sale.update({
        where: { id },
        data: { status: 'REFUNDED', refundedAt: new Date(), amountPaid: new Prisma.Decimal(0), notes: reason ?? sale.notes },
      });
      await this.audit.log({ userId, action: 'sale.refund', entityType: 'Sale', entityId: id, metadata: { reason } }, tx);
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  /** UNDO — hard reverse a mistaken sale: restore inventory then delete the record. */
  async undoSale(id: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const sale = await this.loadSaleOrThrow(tx, id);
      if (sale.status === 'CANCELLED' || sale.status === 'REFUNDED') {
        throw new BadRequestException('Use cancel/refund; this sale is no longer active');
      }
      await this.restoreInventory(tx, id, userId);
      await this.audit.log({ userId, action: 'sale.undo', entityType: 'Sale', entityId: id, metadata: { reference: sale.reference } }, tx);
      // Cascades delete items, shipment (+items/events), payments.
      await tx.sale.delete({ where: { id } });
      return { message: `Sale ${sale.reference} undone and removed; inventory restored` };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  // ===================================================================
  // Reads
  // ===================================================================
  private rangeFilter(range?: string): Prisma.SaleWhereInput {
    if (!range) return {};
    const now = new Date();
    const start = new Date(now);
    if (range === 'today') start.setHours(0, 0, 0, 0);
    else if (range === 'week') start.setDate(now.getDate() - 7);
    else if (range === 'month') start.setMonth(now.getMonth() - 1);
    else if (range === 'year') start.setFullYear(now.getFullYear() - 1);
    return { createdAt: { gte: start } };
  }

  async findAll(query: QuerySaleDto) {
    const where: Prisma.SaleWhereInput = { ...this.rangeFilter(query.range) };
    if (query.status) where.status = query.status;
    if (query.customerId) where.customerId = query.customerId;
    if (query.search) {
      where.OR = [
        { reference: { contains: query.search, mode: 'insensitive' } },
        { customer: { name: { contains: query.search, mode: 'insensitive' } } },
      ];
    }
    const [data, total] = await this.prisma.$transaction([
      this.prisma.sale.findMany({
        where, orderBy: { createdAt: query.sortOrder }, skip: query.skip, take: query.limit,
        include: {
          items: true,
          customer: { select: { name: true } },
          shipment: { select: { status: true, courier: true, trackingNumber: true } },
        },
      }),
      this.prisma.sale.count({ where }),
    ]);
    return paginate(data, total, query);
  }

  async findOne(id: string) {
    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: { items: true, payments: true, customer: true, shipment: { include: { items: true, events: true } } },
    });
    if (!sale) throw new NotFoundException('Sale not found');
    return sale;
  }
}
