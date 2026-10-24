import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { MarketPricesService } from './market-prices.service';
import { Prisma } from '@prisma/client';
import { QuickSource, quickCardMetadata, quickCardPrices } from './quick-add.helpers';
import { selectEnglishCharacter, isEnglishCharacter } from './quick-add.english';
import { QuickAddBatchDto, QueuedQuickAddItemDto } from './dto/quick-add-batch.dto';

@Injectable()
export class QuickAddService {
  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
    private market: MarketPricesService,
  ) {}

  async preview(cardNumber: string, source: QuickSource, listingKey: string, notes = '') {
    const num = cardNumber.trim().toUpperCase();
    if (!/^[A-Z0-9]+-\d{2,3}$/.test(num) ||
        !['YUYUTEI', 'CARDRUSH', 'TCGPLAYER'].includes(source) || !listingKey)
      throw new BadRequestException('Select a valid marketplace listing');
    const candidates = await this.market.listingsFor(num, source);
    const listing = candidates.find(c => c.listingKey === listingKey && c.source === source);
    if (!listing) throw new NotFoundException('Listing not found for this card number. Refresh the source catalog.');
    const metadata = quickCardMetadata(listing);
    // Prefer a direct English catalogue match; never guess when several character names share a card number.
    let englishCatalog: typeof candidates = [];
    if (source !== 'TCGPLAYER') {
      try { englishCatalog = await this.market.listingsFor(num, 'TCGPLAYER'); } catch { /* keep quick add available offline */ }
    }
    const english = selectEnglishCharacter(listing, englishCatalog);
    metadata.character = english ?? '';
    metadata.name = english ?? '';
    const prices = quickCardPrices(listing, await this.settings.getAll(), notes);
    const existing = await this.prisma.rawCard.findFirst({
      where: { marketListingKey: listingKey },
      select: { id: true, name: true, cardNumber: true, quantity: true, postedPrice: true, buyCost: true, notes: true, images: { take: 1, select: { id: true } } },
    });
    if (existing && existing.cardNumber.trim().toUpperCase() !== num)
      throw new ConflictException('This marketplace listing is linked to a different card number. Review the existing record.');
    return {
      cardNumber: num, listing, metadata, ...prices,
      existing: existing ? {
        id: existing.id, name: existing.name, quantity: existing.quantity,
        postedPrice: Number(existing.postedPrice), buyCost: Number(existing.buyCost),
        hasImage: existing.images.length > 0,
      } : null,
    };
  }

  async addBatch(dto: QuickAddBatchDto, userId: string) {
    // One final submission. Item-level errors are returned so remaining stock is not lost.
    // Reject duplicate listing keys in the batch to avoid accidental repeat additions.
    const seen = new Set<string>();
    for (const item of dto.items) {
      if (seen.has(item.listingKey)) throw new BadRequestException('The same source listing is queued twice. Combine quantities before processing.');
      seen.add(item.listingKey);
    }
    const results: { listingKey: string; status: string; cardId?: string; reason?: string; hasImage?: boolean }[] = [];
    for (const item of dto.items) {
      try {
        const result = await this.add(item, userId);
        results.push({ listingKey: item.listingKey, status: result.action, cardId: result.card.id, hasImage: result.hasImage });
      } catch (error: any) {
        results.push({ listingKey: item.listingKey, status: 'failed', reason: error?.response?.message ?? error?.message ?? 'Failed' });
      }
    }
    return { total: results.length, succeeded: results.filter(x => x.status !== 'failed').length, results };
  }

  async add(dto: QueuedQuickAddItemDto, userId: string) {
    const notesInput = (dto.notes ?? '').trim();
    const notes = dto.source === 'TCGPLAYER' && !/\b(?:english|eng)\b/i.test(notesInput)
      ? [notesInput, 'English'].filter(Boolean).join(' · ') : notesInput;
    if (dto.source !== 'TCGPLAYER' && /\b(?:english|eng)\b/i.test(notes))
      throw new BadRequestException('English notes require a TCGplayer listing; select the matching source.');
    const resolved = await this.preview(dto.cardNumber, dto.source, dto.listingKey, notes);
    const englishName = dto.englishName?.trim() || resolved.metadata.name;
    const englishCharacterName = dto.englishCharacter?.trim() || resolved.metadata.character;
    if (!isEnglishCharacter(englishName) || !isEnglishCharacter(englishCharacterName))
      throw new BadRequestException('Confirm an English name and character before saving this listing');
    resolved.metadata.name = englishName;
    resolved.metadata.character = englishCharacterName;
    if (resolved.postedPrice === null && dto.postedPrice === undefined)
      throw new BadRequestException('Configure the currency conversion rate in Settings first');
    const buyCost = dto.buyCost ?? resolved.buyCost;
    const postedPrice = dto.postedPrice ?? resolved.postedPrice!;
    if (!Number.isFinite(buyCost) || !Number.isFinite(postedPrice) || buyCost < 0 || postedPrice < 0)
      throw new BadRequestException('Buying cost and selling price must be valid nonnegative numbers');

    // One atomic stock mutation + idempotency receipt per queued item.
    // An HTTP retry can safely return the original result without adding stock twice.
    const receiptResult = async (id: string) => {
      const receipt = await this.prisma.quickAddReceipt.findUnique({ where: { id } });
      if (!receipt) return null;
      if (receipt.userId !== userId || receipt.listingKey !== dto.listingKey)
        throw new ConflictException('Request ID has already been used for another listing');
      const card = await this.prisma.rawCard.findUnique({ where: { id: receipt.cardId } });
      if (!card) throw new ConflictException('Previously added card was removed. Review inventory before retrying.');
      const hasImage = !!(await this.prisma.cardImage.findFirst({ where: { rawCardId: card.id }, select: { id: true } }));
      return { action: receipt.action, card, hasImage };
    };

    const requestId = dto.requestId;
    if (requestId) {
      const prior = await receiptResult(requestId);
      if (prior) return prior;
    }
    const variantKey = `source:${dto.listingKey}`;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.prisma.$transaction(async tx => {
          if (requestId) {
            const prior = await tx.quickAddReceipt.findUnique({ where: { id: requestId } });
            if (prior) {
              if (prior.userId !== userId || prior.listingKey !== dto.listingKey)
                throw new ConflictException('Request ID collision');
              const card = await tx.rawCard.findUniqueOrThrow({ where: { id: prior.cardId } });
              const image = await tx.cardImage.findFirst({ where: { rawCardId: card.id }, select: { id: true } });
              return { action: prior.action, card, hasImage: !!image };
            }
          }
          const exact = await tx.rawCard.findFirst({ where: { marketListingKey: dto.listingKey } });
          let card;
          let action: string;
          let hasImage = false;
          if (exact) {
            if (exact.cardNumber.trim().toUpperCase() !== resolved.cardNumber)
              throw new ConflictException('Marketplace listing already points to a different card number');
            const nextQty = exact.quantity + dto.quantity;
            const nextCost = buyCost > 0
              ? (exact.quantity * Number(exact.buyCost) + dto.quantity * buyCost) / nextQty
              : Number(exact.buyCost);
            const newNotes = notes && !(exact.notes ?? '').includes(notes)
              ? [exact.notes, notes].filter(Boolean).join(' · ')
              : exact.notes;
            const reactivated = exact.quantity === 0;
            const changed = await tx.rawCard.updateMany({
              where: { id: exact.id, quantity: exact.quantity },
              data: {
                quantity: nextQty, status: nextQty <= 3 ? 'LOW' : 'AVAILABLE',
                buyCost: new Prisma.Decimal(nextCost.toFixed(2)),
                ...(newNotes !== exact.notes ? { notes: newNotes } : {}),
                ...(reactivated ? {
                  postedPrice: new Prisma.Decimal(postedPrice),
                  name: resolved.metadata.name, character: resolved.metadata.character,
                  setName: resolved.metadata.setName, rarity: resolved.metadata.rarity,
                  ...(resolved.metadata.color ? { color: resolved.metadata.color } : {}),
                } : {}),
              },
            });
            if (changed.count !== 1) throw new ConflictException('Stock changed while saving. Retry this item.');
            if (reactivated && Number(exact.postedPrice) !== postedPrice) {
              await tx.priceHistory.create({
                data: { itemType: 'RAW', itemId: exact.id, field: 'postedPrice',
                  oldValue: exact.postedPrice, newValue: new Prisma.Decimal(postedPrice) },
              });
            }
            await tx.restockLog.create({ data: { rawCardId: exact.id, quantityAdded: dto.quantity, buyCost, userId } });
            await tx.inventoryLog.create({
              data: { itemType: 'RAW', rawCardId: exact.id, action: 'RESTOCK',
                quantityDelta: dto.quantity, quantityAfter: nextQty, userId },
            });
            card = await tx.rawCard.findUniqueOrThrow({ where: { id: exact.id } });
            hasImage = !!(await tx.cardImage.findFirst({ where: { rawCardId: exact.id }, select: { id: true } }));
            action = reactivated ? 'reactivated' : 'restocked';
          } else {
            const conflict = await tx.rawCard.findFirst({
              where: { cardNumber: resolved.cardNumber, setName: resolved.metadata.setName,
                rarity: resolved.metadata.rarity, variantKey },
            });
            if (conflict)
              throw new ConflictException('This printing already exists with another marketplace match. Review the existing record.');
            card = await tx.rawCard.create({
              data: {
                cardNumber: resolved.cardNumber, name: resolved.metadata.name,
                setName: resolved.metadata.setName, character: resolved.metadata.character,
                color: resolved.metadata.color,
                rarity: resolved.metadata.rarity, quantity: dto.quantity,
                buyCost: new Prisma.Decimal(buyCost),
                postedPrice: new Prisma.Decimal(postedPrice),
                notes: notes || null, marketListingKey: dto.listingKey, variantKey,
                status: dto.quantity <= 3 ? 'LOW' : 'AVAILABLE',
              },
            });
            await tx.inventoryLog.create({
              data: { itemType: 'RAW', rawCardId: card.id, action: 'CREATE',
                quantityDelta: card.quantity, quantityAfter: card.quantity, userId },
            });
            action = 'created';
          }
          if (requestId) {
            await tx.quickAddReceipt.create({
              data: { id: requestId, listingKey: dto.listingKey, userId, cardId: card.id, action },
            });
          }
          return { action, card, hasImage };
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 25000 });
      } catch (error: any) {
        if (requestId && ['P2002','P2034'].includes(error?.code)) {
          const prior = await receiptResult(requestId);
          if (prior) return prior;
        }
        if (error?.code === 'P2034' && attempt < 2) continue;
        throw error;
      }
    }
    throw new ConflictException('Inventory changed while saving. Retry the batch.');
  }
}
