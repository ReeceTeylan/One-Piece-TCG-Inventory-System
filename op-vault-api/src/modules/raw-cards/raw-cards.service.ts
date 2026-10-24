import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
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
    // Distinct art variants must not collapse into a single stock record.
    const variantKey = dto.variantKey || (dto.marketListingKey ? `source:${dto.marketListingKey}` : 'standard');
    const existing = await this.repo.findByIdentity(dto.cardNumber, dto.setName, dto.rarity, variantKey);
    if (existing) {
      throw new ConflictException({
        code: 'CARD_EXISTS',
        message: 'This card already exists. Would you like to add the quantity instead?',
        cardId: existing.id,
        currentQuantity: existing.quantity,
      });
    }
    // Do not persist a mismatched listing if the card number was edited after selection.
    if (dto.marketListingKey) {
      const where = { listingKey: dto.marketListingKey, cardNumber: dto.cardNumber.trim().toUpperCase() };
      const found = dto.marketListingKey.startsWith('tcgp:')
        ? await this.prisma.tcgplayerPrice.findFirst({ where, select: { listingKey: true } })
        : await this.prisma.marketPrice.findFirst({ where, select: { listingKey: true } });
      if (!found) throw new BadRequestException('Selected artwork listing does not match this card number');
    }
    const card = await this.repo.create({
      ...dto,
      variantKey,
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
        const existing = await this.repo.findByIdentity(row.cardNumber, row.setName, row.rarity, row.variantKey || (row.marketListingKey ? `source:${row.marketListingKey}` : 'standard'));
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
    if (query.inStock) where.quantity = { gt: 0 };
    if (query.rarity) where.rarity = query.rarity;
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      where.postedPrice = {
        ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}),
        ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}),
      };
    }
    if (query.search) {
      const term = query.search.trim();
      // Card numbers are stored as "OP13-114" but get typed as "OP13 114".
      // For two-token terms only, also search the dash/space-swapped form.
      // Gated so normal name searches ("monkey d luffy") don't fan out.
      const terms = /^[a-z0-9]+[\s-][a-z0-9]+$/i.test(term)
        ? Array.from(new Set([term, term.replace(/\s+/g, '-'), term.replace(/-/g, ' ')]))
        : [term];
      where.OR = terms.flatMap((t) => [
        { name: { contains: t, mode: 'insensitive' as const } },
        { cardNumber: { contains: t, mode: 'insensitive' as const } },
        { setName: { contains: t, mode: 'insensitive' as const } },
        { character: { contains: t, mode: 'insensitive' as const } },
        { notes: { contains: t, mode: 'insensitive' as const } },
      ]);
    }
    const sortable = ['name', 'postedPrice', 'quantity', 'createdAt', 'buyCost'];
    const sortBy = sortable.includes(query.sortBy ?? '') ? query.sortBy! : 'createdAt';
    // Secondary sort by id guarantees a STABLE, deterministic order so paginated
    // results never duplicate/skip rows when the primary field has ties.
    const orderBy = [{ [sortBy]: query.sortOrder }, { id: 'asc' as const }];
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
    if (!Number.isInteger(quantity) || quantity <= 0 || !Number.isFinite(buyCost) || buyCost < 0)
      throw new BadRequestException('Quantity must be positive and buying cost must be nonnegative');
    // Compare-and-swap protects a concurrent sale, stock count, or second restock
    // from being silently lost. A stale calculation fails and can be retried.
    return this.prisma.$transaction(async tx => {
      const card = await tx.rawCard.findUnique({ where: { id } });
      if (!card) throw new NotFoundException('Raw card not found');
      const newQty = card.quantity + quantity;
      const average = buyCost > 0
        ? (card.quantity * Number(card.buyCost) + quantity * buyCost) / newQty
        : Number(card.buyCost);
      const changed = await tx.rawCard.updateMany({
        where: { id, quantity: card.quantity },
        data: { quantity: newQty, status: this.computeStatus(newQty), buyCost: new Prisma.Decimal(average.toFixed(2)) },
      });
      if (changed.count !== 1)
        throw new ConflictException('Inventory changed while restocking. Refresh and retry.');
      await tx.restockLog.create({ data: { rawCardId: id, quantityAdded: quantity, buyCost, userId } });
      await tx.inventoryLog.create({
        data: { itemType: 'RAW', rawCardId: id, action: 'RESTOCK',
          quantityDelta: quantity, quantityAfter: newQty, userId },
      });
      return tx.rawCard.findUniqueOrThrow({ where: { id } });
    });
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
