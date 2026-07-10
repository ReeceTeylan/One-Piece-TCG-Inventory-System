import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StockStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { paginate } from '../../common/dto/pagination.dto';
import { RawCardsRepository } from './raw-cards.repository';
import { CreateRawCardDto } from './dto/create-raw-card.dto';
import { UpdateRawCardDto } from './dto/update-raw-card.dto';
import { QueryRawCardDto } from './dto/query-raw-card.dto';
import { RestockDto } from './dto/restock.dto';

const LOW_STOCK = 3;

@Injectable()
export class RawCardsService {
  constructor(private repo: RawCardsRepository, private prisma: PrismaService) {}

  private computeStatus(qty: number): StockStatus {
    if (qty <= 0) return 'OUT';
    if (qty <= LOW_STOCK) return 'LOW';
    return 'AVAILABLE';
  }

  async create(dto: CreateRawCardDto, userId: string) {
    // Server-side duplicate detection on (cardNumber, setName, rarity)
    const existing = await this.repo.findByIdentity(dto.cardNumber, dto.setName, dto.rarity);
    if (existing) {
      throw new ConflictException({
        code: 'CARD_EXISTS',
        message: 'This card already exists. Would you like to add the quantity instead?',
        cardId: existing.id,
        currentQuantity: existing.quantity,
      });
    }
    const card = await this.repo.create({
      ...dto,
      status: this.computeStatus(dto.quantity),
    });
    await this.prisma.inventoryLog.create({
      data: { itemType: 'RAW', rawCardId: card.id, action: 'CREATE',
        quantityDelta: card.quantity, quantityAfter: card.quantity, userId },
    });
    return card;
  }
  
  // Bulk restock/import. Matches existing cards on the DB identity
  // (cardNumber + setName + rarity); adds quantity to matches, creates the rest.
  async importCards(rows: CreateRawCardDto[], userId: string) {
    let created = 0;
    let restocked = 0;
    const errors: { row: number; reason: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const existing = await this.repo.findByIdentity(row.cardNumber, row.setName, row.rarity);
        if (existing) {
          await this.addQuantity(existing.id, row.quantity, Number(row.buyCost) || 0, userId);
          restocked++;
        } else {
          await this.create(row, userId);
          created++;
        }
      } catch (e: any) {
        errors.push({ row: i + 1, reason: e?.message ?? 'Unknown error' });
      }
    }

    return { total: rows.length, created, restocked, errors };
  }

  async findAll(query: QueryRawCardDto) {
    const where: Prisma.RawCardWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.rarity) where.rarity = query.rarity;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { cardNumber: { contains: query.search, mode: 'insensitive' } },
        { setName: { contains: query.search, mode: 'insensitive' } },
        { character: { contains: query.search, mode: 'insensitive' } },
        { notes: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    const sortable = ['name', 'postedPrice', 'quantity', 'createdAt', 'buyCost'];
    const sortBy = sortable.includes(query.sortBy ?? '') ? query.sortBy! : 'createdAt';
    const orderBy = { [sortBy]: query.sortOrder };
    const { data, total } = await this.repo.findMany(where, orderBy, query.skip, query.limit);
    return paginate(data, total, query);
  }

  async findOne(id: string) {
    const card = await this.repo.findById(id);
    if (!card) throw new NotFoundException('Raw card not found');
    return card;
  }

  async update(id: string, dto: UpdateRawCardDto) {
    const card = await this.findOne(id);
    // price history tracking
    if (dto.postedPrice !== undefined && Number(dto.postedPrice) !== Number(card.postedPrice)) {
      await this.prisma.priceHistory.create({
        data: { itemType: 'RAW', itemId: id, field: 'postedPrice',
          oldValue: card.postedPrice, newValue: dto.postedPrice },
      });
    }
    const data: Prisma.RawCardUpdateInput = { ...dto };
    if (dto.quantity !== undefined) data.status = this.computeStatus(dto.quantity);
    return this.repo.update(id, data);
  }

  async addQuantity(id: string, quantity: number, buyCost: number, userId: string) {
    const card = await this.findOne(id);
    const newQty = card.quantity + quantity;
    const updated = await this.prisma.$transaction(async (tx) => {
      const c = await tx.rawCard.update({
        where: { id }, data: { quantity: newQty, status: this.computeStatus(newQty) },
      });
      await tx.restockLog.create({ data: { rawCardId: id, quantityAdded: quantity, buyCost, userId } });
      await tx.inventoryLog.create({
        data: { itemType: 'RAW', rawCardId: id, action: 'RESTOCK',
          quantityDelta: quantity, quantityAfter: newQty, userId },
      });
      return c;
    });
    return updated;
  }

  restock(id: string, dto: RestockDto, userId: string) {
    return this.addQuantity(id, dto.quantityAdded, dto.buyCost, userId);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.repo.delete(id);
    return { message: 'Raw card deleted' };
  }
}
