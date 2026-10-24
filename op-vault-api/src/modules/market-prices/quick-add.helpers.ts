import { BadRequestException } from '@nestjs/common';
import { roundPrice, damageReason } from './market-match';

export type QuickSource = 'YUYUTEI' | 'CARDRUSH' | 'TCGPLAYER';
export interface QuickCandidate {
  source: QuickSource; listingKey: string; cardNumber: string; name: string; rarity: string | null;
  setLabel: string; price: number; currency: string; imageUrl?: string | null; url: string;
}
const clean = (s: string) => s.trim().replace(/\s+/g, ' ');

export function quickCardMetadata(card: QuickCandidate) {
  const prefix = card.cardNumber.split('-')[0].toUpperCase();
  const setName = card.source === 'YUYUTEI' ? (card.setLabel || prefix).toUpperCase()
    : card.source === 'TCGPLAYER' ? (card.setLabel || prefix).toUpperCase() : prefix;
  let rarity = clean(card.rarity || 'Unknown').toUpperCase();
  if (card.source === 'CARDRUSH' && /\/P$/i.test(rarity)) rarity = 'P' + rarity.slice(0, -2);
  else if (card.source === 'YUYUTEI') rarity = rarity.replace(/^P-/, 'P');
  else if (card.source === 'TCGPLAYER') {
    const isParallel = /\b(?:parallel|alternate art|alt art)\b/i.test(card.name);
    const short: Record<string, string> = {
      COMMON: 'C', UNCOMMON: 'UC', RARE: 'R', 'SUPER RARE': 'SR',
      'SECRET RARE': 'SEC', LEADER: 'Leader', SPECIAL: 'SP',
    };
    rarity = short[rarity] ?? rarity;
    if (isParallel && /^(C|UC|R|SR|SEC|L)$/i.test(rarity)) rarity = 'P' + rarity;
  }
  if (rarity === 'L') rarity = 'Leader';
  // Catalogs currently provide names/printings but not trustworthy color metadata.
  // Never infer color from imagery or character identity.
  let name = clean(card.name)
    .replace(/^〔[^〕]*〕/g, '')
    .replace(/【[^】]*】/g, '')
    .replace(/\{[^}]*\}/g, '')
    .replace(/\s*\((?:\d{1,3}|parallel|alternate art|alt art)\)/gi, '');
  const character = name.replace(/[（(][^)）]*[)）]/g, '').trim() || name;
  if (!name) name = card.name;
  return { name, character, setName, rarity, color: null as string | null };
}

export function quickCardPrices(card: QuickCandidate, settings: Record<string, unknown>, notes: string) {
  if (!Number.isFinite(card.price) || card.price <= 0) throw new BadRequestException('This listing has no valid market price');
  const en = card.source === 'TCGPLAYER';
  const damage = !!damageReason(notes);
  const key = en ? (damage ? 'usdToPhpRateDamaged' : 'usdToPhpRate')
    : (damage ? 'jpyToPhpRateDamaged' : 'jpyToPhpRate');
  // Mirror existing price suggestion: damaged rate is used only when configured.
  const fallbackKey = en ? 'usdToPhpRate' : 'jpyToPhpRate';
  const rate = Number(settings[key]) > 0 ? Number(settings[key]) : Number(settings[fallbackKey]);
  const purchaseRate = en ? 35 : 0.2;
  return {
    purchaseRate, rate: Number.isFinite(rate) && rate > 0 ? rate : null,
    buyCost: Math.round(card.price * purchaseRate * 100) / 100,
    postedPrice: Number.isFinite(rate) && rate > 0 ? roundPrice(Math.round(card.price * rate)) : null,
  };
}
