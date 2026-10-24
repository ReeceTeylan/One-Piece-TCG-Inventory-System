import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RawCardsService } from '../raw-cards/raw-cards.service';
import { SettingsService } from '../settings/settings.service';
import { MarketPricesService } from './market-prices.service';
import { QuickAddDto } from './dto/quick-add.dto';
import { QuickSource, quickCardMetadata, quickCardPrices } from './quick-add.helpers';
import { selectEnglishCharacter, isEnglishCharacter } from './quick-add.english';
import { QuickAddBatchDto, QueuedQuickAddItemDto } from './dto/quick-add-batch.dto';

@Injectable()
export class QuickAddService {
  constructor(
    private prisma: PrismaService,
    private rawCards: RawCardsService,
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

    const exact = await this.prisma.rawCard.findFirst({ where: { marketListingKey: dto.listingKey } });
    if (exact) {
      if (exact.cardNumber.trim().toUpperCase() !== resolved.cardNumber)
        throw new ConflictException('This marketplace listing is linked to a different card');
      // An active listing keeps its posted price; a sold-out one takes the new rate and metadata.
      if (exact.quantity === 0) {
        await this.rawCards.update(exact.id, {
          name: resolved.metadata.name, character: resolved.metadata.character,
          setName: resolved.metadata.setName, rarity: resolved.metadata.rarity,
          postedPrice,
          ...(resolved.metadata.color ? { color: resolved.metadata.color } : {}),
          notes: notes || exact.notes || undefined,
        });
      } else if (notes) {
        // Preserve old notes including damage/English marker when adding stock.
        const prev = (exact.notes ?? '').trim();
        if (!prev.includes(notes))
          await this.rawCards.update(exact.id, { notes: [prev, notes].filter(Boolean).join(' · ') });
      } else if (dto.source === 'TCGPLAYER' && !/\b(?:english|eng)\b/i.test(exact.notes ?? '')) {
        await this.rawCards.update(exact.id, { notes: [exact.notes, 'English'].filter(Boolean).join(' · ') });
      }
      const card = await this.rawCards.addQuantity(exact.id, dto.quantity, buyCost, userId);
      const hasImage = !!(await this.prisma.cardImage.findFirst({ where: { rawCardId: exact.id }, select: { id: true } }));
      return { action: exact.quantity === 0 ? 'reactivated' : 'restocked', card, hasImage };
    }
    // The legacy composite identity cannot safely distinguish alternate artworks.
    // Never restock another variant simply because its number, set and rarity match.
    const conflict = await this.prisma.rawCard.findFirst({
      where: { cardNumber: resolved.cardNumber, setName: resolved.metadata.setName, rarity: resolved.metadata.rarity },
      select: { id: true, name: true, marketListingKey: true },
    });
    if (conflict) throw new ConflictException({
      code: 'CARD_VARIANT_CONFLICT', cardId: conflict.id,
      message: 'A different artwork shares this card number, set and rarity. Open the existing card and review it before adding stock.',
    });
    const card = await this.rawCards.create({
      cardNumber: resolved.cardNumber,
      name: resolved.metadata.name,
      setName: resolved.metadata.setName,
      character: resolved.metadata.character,
      ...(resolved.metadata.color ? { color: resolved.metadata.color } : {}),
      rarity: resolved.metadata.rarity,
      quantity: dto.quantity, buyCost, postedPrice,
      notes: notes || undefined,
      marketListingKey: dto.listingKey,
    }, userId);
    return { action: 'created', card, hasImage: false };
  }
}
