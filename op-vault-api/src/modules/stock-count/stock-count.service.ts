import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { StockStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { AdjustStockDto } from './dto/adjust-stock.dto';

// Same rules as RawCardsService / SlabsService.computeStatus — keep in sync.
const RAW_LOW_STOCK = 3;
const rawStatus = (qty: number): StockStatus =>
  qty <= 0 ? 'OUT' : qty <= RAW_LOW_STOCK ? 'LOW' : 'AVAILABLE';
const sealedStatus = (qty: number): StockStatus => (qty <= 0 ? 'SOLD' : 'AVAILABLE');

@Injectable()
export class StockCountService {
  constructor(private prisma: PrismaService, private audit: ActivityLogsService) {}

  /**
   * Set an item's quantity to the physically counted value.
   * Optimistic check: only applies if the stored quantity still equals
   * expectedQty, so a sale made mid-count is never silently overwritten.
   */
  async adjust(dto: AdjustStockDto, userId: string) {
    const { itemType, id, expectedQty, countedQty } = dto;
    const delta = countedQty - expectedQty;

    return this.prisma.$transaction(async (tx) => {
      let name: string;

      if (itemType === 'RAW') {
        const card = await tx.rawCard.findUnique({ where: { id }, select: { name: true, quantity: true } });
        if (!card) throw new NotFoundException('Raw card not found');
        if (card.quantity !== expectedQty) throw this.changed(card.quantity);
        name = card.name;
        if (delta === 0) return { changed: false, quantity: countedQty, delta };
        const res = await tx.rawCard.updateMany({
          where: { id, quantity: expectedQty },
          data: { quantity: countedQty, status: rawStatus(countedQty) },
        });
        if (res.count === 0) throw this.changed();
      } else {
        const slab = await tx.slabCard.findUnique({ where: { id }, select: { name: true, quantity: true, kind: true } });
        if (!slab) throw new NotFoundException('Item not found');
        if (slab.kind !== 'SEALED') {
          throw new ConflictException({
            code: 'SLAB_NOT_STACKABLE',
            message: 'Graded slabs are unique items — quantity applies to sealed products only.',
          });
        }
        if (slab.quantity !== expectedQty) throw this.changed(slab.quantity);
        name = slab.name;
        if (delta === 0) return { changed: false, quantity: countedQty, delta };
        const res = await tx.slabCard.updateMany({
          where: { id, quantity: expectedQty },
          data: { quantity: countedQty, status: sealedStatus(countedQty) },
        });
        if (res.count === 0) throw this.changed();
      }

      await tx.inventoryLog.create({
        data: {
          itemType,
          rawCardId: itemType === 'RAW' ? id : undefined,
          slabId: itemType === 'SLAB' ? id : undefined,
          action: 'ADJUST',
          quantityDelta: delta,
          quantityAfter: countedQty,
          reference: 'STOCK_COUNT',
          userId,
        },
      });
      await this.audit.log(
        {
          userId,
          action: 'stock-count.adjust',
          entityType: itemType === 'RAW' ? 'RawCard' : 'SlabCard',
          entityId: id,
          metadata: { name, from: expectedQty, to: countedQty, delta },
        },
        tx,
      );
      return { changed: true, quantity: countedQty, delta };
    });
  }

  private changed(current?: number) {
    return new ConflictException({
      code: 'STOCK_CHANGED',
      message: 'Quantity changed since you loaded it (maybe a sale). Refresh and count again.',
      current,
    });
  }
}
