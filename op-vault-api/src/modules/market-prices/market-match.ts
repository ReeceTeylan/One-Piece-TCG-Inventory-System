/**
 * Pure matching + pricing rules for the Yuyu-tei price sync. No DB access,
 * so they can be unit-tested against parsed pages.
 */

/** OP-Vault rarity → Yuyu-tei section label. Keys are normalised by normRarity().
 *  Seen on real pages: SEC, P-SEC, L, P-L. The rest follow the same "P-" pattern
 *  for parallels; a wrong guess just means "no match" (fixable with a manual link). */
const RARITY_MAP: Record<string, string> = {
  C: 'C', UC: 'UC', R: 'R', SR: 'SR', SEC: 'SEC', SP: 'SP',
  L: 'L', LEADER: 'L',
  PC: 'P-C', PR: 'P-R', PSR: 'P-SR', PSEC: 'P-SEC', PL: 'P-L',
  PROMO: 'P',
  // DON / GOLD DON intentionally unmapped.
};

const normRarity = (r: string) => r.trim().toUpperCase().replace(/[\s-]/g, '');

export function toYuyuteiRarity(rarity: string): string | null {
  return RARITY_MAP[normRarity(rarity)] ?? null;
}

export interface ListingLike {
  listingKey: string;
  cardNumber: string;
  rarity: string;
  name: string;
}

const countParens = (name: string) => (name.match(/[(（]/g) ?? []).length;

/**
 * Default listing for a card: same card number + mapped rarity, preferring
 *  1. the original set's printing ("op01/…" for OP01-120) over reprints/promos,
 *  2. the plainest name (fewest "(…)" tags: no stamp / super parallel / PRB),
 *  3. then a stable order.
 */
export function pickAutoListing<T extends ListingLike>(
  card: { cardNumber: string; rarity: string },
  listings: T[],
): T | null {
  const want = toYuyuteiRarity(card.rarity);
  if (!want) return null;
  const num = card.cardNumber.trim().toUpperCase();
  const candidates = listings.filter((l) => l.cardNumber === num && l.rarity === want);
  if (!candidates.length) return null;
  const home = `${num.split('-')[0].toLowerCase()}/`;
  return [...candidates].sort((a, b) =>
    Number(b.listingKey.startsWith(home)) - Number(a.listingKey.startsWith(home))
    || countParens(a.name) - countParens(b.name)
    || a.listingKey.localeCompare(b.listingKey),
  )[0];
}

export interface PriceComparison {
  marketPhp: number | null;
  diffPct: number | null;   // (posted − market) / market × 100, one decimal
  underpriced: boolean;
}

/** Underpriced = posted price below `pct`% of the converted Yuyu-tei price. */
export function comparePrice(postedPhp: number, priceJpy: number, rate: number | null, pct: number): PriceComparison {
  if (!rate || rate <= 0 || priceJpy <= 0) return { marketPhp: null, diffPct: null, underpriced: false };
  const marketPhp = Math.round(priceJpy * rate);
  if (marketPhp <= 0) return { marketPhp, diffPct: null, underpriced: false };
  const diffPct = Math.round(((postedPhp - marketPhp) / marketPhp) * 1000) / 10;
  return { marketPhp, diffPct, underpriced: postedPhp < marketPhp * (pct / 100) };
}
