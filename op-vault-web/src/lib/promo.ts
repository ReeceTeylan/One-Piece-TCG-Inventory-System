import type { Promo } from '@/types';

/** Tiered rounding — matches the bulk price tool: nearest ₱10, or ₱100 at/above ₱5,000. */
export function roundPrice(p: number): number {
  const rounded = p >= 5000 ? Math.round(p / 100) * 100 : Math.round(p / 10) * 10;
  return Math.max(0, rounded);
}

/** True if the promo is running right now. */
export function isPromoActive(promo?: Promo | null): promo is Promo {
  if (!promo || promo.endedAt) return false;
  const now = Date.now();
  return new Date(promo.startsAt).getTime() <= now && now < new Date(promo.endsAt).getTime();
}

/** Price after promo, rounded. Raw cards only — slabs return full price. */
export function promoPrice(price: number | string, promo?: Promo | null, itemType: 'RAW' | 'SLAB' = 'RAW'): number {
  const base = Number(price);
  if (itemType !== 'RAW' || !isPromoActive(promo)) return base;
  const pct = Number(promo.percentage);
  return roundPrice(base * (1 - pct / 100));
}

/** Milliseconds until the promo ends (0 if not running). */
export function promoTimeLeft(promo?: Promo | null): number {
  if (!isPromoActive(promo)) return 0;
  return Math.max(0, new Date(promo.endsAt).getTime() - Date.now());
}

/** "5h 23m" style countdown. */
export function formatTimeLeft(ms: number): string {
  if (ms <= 0) return 'ended';
  const totalMinutes = Math.floor(ms / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}