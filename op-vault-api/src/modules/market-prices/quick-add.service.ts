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
    // Canonical, owner-imported English catalog beats incomplete marketplace titles.
    // Never infer artwork/printing rarity from the base card catalog.
    const official = await this.prisma.cardCatalogEntry.findUnique({ where: { cardNumber: num } });
    const english = official?.englishName || selectEnglishCharacter(listing, englishCatalog);
    metadata.character = english ?? '';
    metadata.name = english ?? '';
    if (official?.colors?.length) metadata.color = official.colors.join(' / ');
    if (official?.setName && !metadata.setName) metadata.setName = official.setName;
    const prices = quickCardPrices(listing, await this.settings.getAll(), notes);
    const linked = await this.prisma.rawCard.findMany({
      where: { marketListingKey: listingKey },
      take: 2,
      select: { id: true, name: true, cardNumber: true, quantity: true, postedPrice: true, buyCost: true, notes: true, images: { take: 1, select: { id: true } } },
    });
    if (linked.length > 1) throw new ConflictException('Marketplace listing is linked to multiple inventory records. Please correct the links manually before restocking.');
    const existing = linked[0];
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


  /** Show sold-out inventory for an exact card ID without changing marketplace links. */
  async soldOutListings(cardNumber: string) {
    const num = cardNumber.trim().toUpperCase();
    if (!/^[A-Z0-9]+-\d{2,3}$/.test(num))
      throw new BadRequestException('Enter a valid card number');
    const rows = await this.prisma.rawCard.findMany({
      where: { cardNumber: { equals: num, mode: 'insensitive' }, quantity: 0 },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      take: 40,
      select: {
        id: true, name: true, cardNumber: true, setName: true, character: true,
        rarity: true, color: true, buyCost: true, postedPrice: true,
        marketListingKey: true, quantity: true,
        images: { take: 1, orderBy: { isPrimary: 'desc' }, select: { url: true } },
      },
    });
    return rows.map(({ images, buyCost, postedPrice, ...row }) => ({
      ...row, buyCost: Number(buyCost), postedPrice: Number(postedPrice),
      imageUrl: images[0]?.url ?? null,
    }));
  }

  /** Restock by ID, preserving artwork; optionally attach a verified marketplace listing to an unlinked card. */
  private async restockSelected(dto: QueuedQuickAddItemDto, userId: string) {
    const id = dto.existingCardId!;
    if (dto.listingKey !== `existing:${id}`)
      throw new BadRequestException('Existing record selection does not match the queued listing');
    const buyCost = dto.buyCost;
    const postedPrice = dto.postedPrice;
    if (buyCost === undefined || !Number.isFinite(buyCost) || buyCost < 0 ||
        (postedPrice !== undefined && (!Number.isFinite(postedPrice) || postedPrice < 0)))
      throw new BadRequestException('Enter valid buying and selling prices');

    const replay = async () => {
      if (!dto.requestId) return null;
      const receipt = await this.prisma.quickAddReceipt.findUnique({ where: { id: dto.requestId } });
      if (!receipt) return null;
      if (receipt.userId !== userId || receipt.listingKey !== dto.listingKey || receipt.cardId !== id)
        throw new ConflictException('This request ID has already been used for a different card');
      const card = await this.prisma.rawCard.findUnique({ where: { id } });
      if (!card) throw new ConflictException('The previously restocked card no longer exists');
      const image = await this.prisma.cardImage.findFirst({ where: { rawCardId: id }, select: { id: true } });
      return { action: receipt.action, card, hasImage: !!image };
    };
    const previous = await replay();
    if (previous) return previous;
    // Only a user-selected candidate from this source and exact card number may be linked.
    // Never trust a supplied marketplace key by itself or replace existing photos.
    if (dto.marketLinkKey) {
      const num = dto.cardNumber.trim().toUpperCase();
      const candidates = await this.market.listingsFor(num, dto.source);
      if (!candidates.some(c => c.listingKey === dto.marketLinkKey &&
        c.source === dto.source && c.cardNumber.trim().toUpperCase() === num)) {
        throw new BadRequestException('Selected marketplace listing does not match this card number and source.');
      }
    }
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          if (dto.requestId) {
            const receipt = await tx.quickAddReceipt.findUnique({ where: { id: dto.requestId } });
            if (receipt) {
              if (receipt.userId !== userId || receipt.listingKey !== dto.listingKey || receipt.cardId !== id)
                throw new ConflictException('Request ID collision');
              const card = await tx.rawCard.findUniqueOrThrow({ where: { id } });
              const image = await tx.cardImage.findFirst({ where: { rawCardId: id }, select: { id: true } });
              return { action: receipt.action, card, hasImage: !!image };
            }
          }
          const existing = await tx.rawCard.findUnique({ where: { id } });
          if (!existing) throw new NotFoundException('Existing card was removed');
          if (existing.cardNumber.trim().toUpperCase() !== dto.cardNumber.trim().toUpperCase())
            throw new ConflictException('Card number changed. Choose the correct existing listing again.');
          const currentLink = existing.marketListingKey;
          const unlinked = !currentLink || currentLink === 'none';
          if (dto.marketLinkKey && !unlinked && currentLink !== dto.marketLinkKey)
            throw new ConflictException('This card already has a marketplace link. Manage that link separately to avoid replacing it.');
          const attachLink = !!dto.marketLinkKey && unlinked;
          if (attachLink) {
            const linkedElsewhere = await tx.rawCard.findMany({
              where: { marketListingKey: dto.marketLinkKey },
              select: { id: true }, take: 2,
            });
            if (linkedElsewhere.some(c => c.id !== id))
              throw new ConflictException('This marketplace listing is already linked to another card. Choose a different printing.');
          }
          const nextQty = existing.quantity + dto.quantity;
          const avg = buyCost > 0
            ? (existing.quantity * Number(existing.buyCost) + dto.quantity * buyCost) / nextQty
            : Number(existing.buyCost);
          const reactivated = existing.quantity === 0;
          const changedPrice = reactivated && postedPrice !== undefined &&
            Number(existing.postedPrice) !== postedPrice;
          const notes = dto.notes?.trim();
          const nextNotes = notes && !(existing.notes ?? '').includes(notes)
            ? [existing.notes, notes].filter(Boolean).join(' · ')
            : existing.notes;
          const changed = await tx.rawCard.updateMany({
            where: { id, quantity: existing.quantity,
              ...(dto.marketLinkKey ? { marketListingKey: currentLink } : {}) },
            data: {
              quantity: nextQty, status: nextQty <= 3 ? 'LOW' : 'AVAILABLE',
              ...(attachLink ? { marketListingKey: dto.marketLinkKey } : {}),
              buyCost: new Prisma.Decimal(avg.toFixed(2)),
              ...(changedPrice ? { postedPrice: new Prisma.Decimal(postedPrice!) } : {}),
              ...(nextNotes !== existing.notes ? { notes: nextNotes } : {}),
            },
          });
          if (changed.count !== 1) throw new ConflictException('Stock changed during restock. Retry this item.');
          if (changedPrice) {
            await tx.priceHistory.create({
              data: { itemType: 'RAW', itemId: id, field: 'postedPrice',
                oldValue: existing.postedPrice, newValue: new Prisma.Decimal(postedPrice!) },
            });
          }
          await tx.restockLog.create({
            data: { rawCardId: id, quantityAdded: dto.quantity, buyCost, userId },
          });
          await tx.inventoryLog.create({
            data: { itemType: 'RAW', rawCardId: id, action: 'RESTOCK',
              quantityDelta: dto.quantity, quantityAfter: nextQty, userId },
          });
          if (dto.requestId) await tx.quickAddReceipt.create({
            data: { id: dto.requestId, listingKey: dto.listingKey,
              userId, cardId: id, action: reactivated ? 'reactivated' : 'restocked' },
          });
          const card = await tx.rawCard.findUniqueOrThrow({ where: { id } });
          const image = await tx.cardImage.findFirst({ where: { rawCardId: id }, select: { id: true } });
          return { action: reactivated ? 'reactivated' : 'restocked', card, hasImage: !!image };
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 25000 });
      } catch (error: any) {
        if (dto.requestId && ['P2002', 'P2034'].includes(error?.code)) {
          const saved = await replay();
          if (saved) return saved;
        }
        if (error?.code === 'P2034' && attempt < 2) continue;
        throw error;
      }
    }
    throw new ConflictException('Concurrent stock change. Retry the batch.');
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
    if (dto.existingCardId) return this.restockSelected(dto, userId);
    if (dto.marketLinkKey) throw new BadRequestException('Marketplace linking is only available when reusing an existing listing.');
    // Resolve a completed request before relying on a marketplace that may be temporarily down.
    if (dto.requestId) {
      const prior = await this.prisma.quickAddReceipt.findUnique({ where: { id: dto.requestId } });
      if (prior) {
        if (prior.listingKey !== dto.listingKey || prior.userId !== userId)
          throw new ConflictException('Request ID already belongs to another listing');
        const card = await this.prisma.rawCard.findUnique({ where: { id: prior.cardId } });
        if (!card) throw new ConflictException('Original card was removed. Please review inventory.');
        const image = await this.prisma.cardImage.findFirst({ where: { rawCardId: card.id }, select: { id: true } });
        return { action: prior.action, card, hasImage: !!image };
      }
    }
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
          const matches = await tx.rawCard.findMany({ where: { marketListingKey: dto.listingKey }, take: 2 });
          if (matches.length > 1) throw new ConflictException('Marketplace listing is linked to multiple stock records. Review and correct these links manually.');
          const exact = matches[0];
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
