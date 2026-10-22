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

/** Underpriced = posted price below `pct`% of the converted market price.
 *  `foreignPrice` is yen (Yuyu-tei) or US dollars (TCGplayer); `rate` is pesos per 1 of it. */
export function comparePrice(postedPhp: number, foreignPrice: number, rate: number | null, pct: number): PriceComparison {
  if (!rate || rate <= 0 || foreignPrice <= 0) return { marketPhp: null, diffPct: null, underpriced: false };
  const marketPhp = Math.round(foreignPrice * rate);
  if (marketPhp <= 0) return { marketPhp, diffPct: null, underpriced: false };
  const diffPct = Math.round(((postedPhp - marketPhp) / marketPhp) * 1000) / 10;
  return { marketPhp, diffPct, underpriced: postedPhp < marketPhp * (pct / 100) };
}

// ------------------------------------------------------------------
// Notes-based rules
// ------------------------------------------------------------------

/** English printings are priced from TCGplayer instead of Yuyu-tei. */
const ENGLISH_RE = /\b(english|eng)\b/i;
export function isEnglish(notes?: string | null): boolean {
  return !!notes && ENGLISH_RE.test(notes);
}

/** Condition words that switch a card to the lower "damaged" rates.
 *  Ignored when negated ("no whites", "without dents"). Returns the word found. */
const DAMAGE_RE = /\b(whites?|dents?|dented|scratch(?:es|ed)?|issues?)\b/gi;
export function damageReason(notes?: string | null): string | null {
  if (!notes) return null;
  for (const m of notes.matchAll(DAMAGE_RE)) {
    const before = notes.slice(Math.max(0, m.index! - 9), m.index).toLowerCase();
    if (/\b(no|without)\s+$/.test(before)) continue;
    return m[1].toLowerCase();
  }
  return null;
}

/** Same tiers as the web app's roundPrice: nearest ₱10, or ₱100 at ₱5,000+. */
export function roundPrice(p: number): number {
  const rounded = p >= 5000 ? Math.round(p / 100) * 100 : Math.round(p / 10) * 10;
  return Math.max(0, rounded);
}

// ------------------------------------------------------------------
// TCGplayer (via TCGCSV) matching for English cards
// ------------------------------------------------------------------

export interface TcgLike {
  listingKey: string;        // "tcgp:<productId>:<subTypeName>"
  productId: number;
  subTypeName: string;       // "Normal" | "Foil"
  cardNumber: string;        // "OP01-001"
  rarity: string | null;     // TCGplayer rarity: "L", "SEC"… (parallels keep the base rarity)
  name: string;              // "Roronoa Zoro (001) (Parallel)"
  groupAbbr: string | null;  // "OP01", "PRB-01"
}

const PARALLEL_NAME = /\((?:parallel|alternate art)\)/i;
const NUMBER_TAG = /^\(?(?:[A-Z]{1,4}\d{0,3}-)?\d{1,3}\)?$/i; // "(001)", "(OP01-120)", "(P-053)"

/** Extra "(…)" tags on a TCGplayer name, ignoring the card-number tag. */
function tcgTags(name: string): number {
  return (name.match(/\([^)]*\)/g) ?? []).filter((t) => !NUMBER_TAG.test(t)).length;
}

/** OP-Vault parallel codes: PSR, PSEC, PL, PR, PC (not "Promo"). */
export function isParallelRarity(rarity: string): boolean {
  const r = rarity.trim().toUpperCase().replace(/[\s-]/g, '');
  return /^P(C|UC|R|SR|SEC|L)$/.test(r);
}

const TCG_BASE: Record<string, string> = {
  C: 'C', UC: 'UC', R: 'R', SR: 'SR', SEC: 'SEC', SP: 'SP', L: 'L', LEADER: 'L',
  PC: 'C', PUC: 'UC', PR: 'R', PSR: 'SR', PSEC: 'SEC', PL: 'L',
};

/**
 * Default TCGplayer product for an English card: same number, base rarity,
 * parallel-or-not from the name, preferring the card's own set (OP01 for
 * OP01-xxx) and the plainest name; Foil row for parallels, Normal otherwise.
 */
export function pickTcgListing<T extends TcgLike>(card: { cardNumber: string; rarity: string }, rows: T[]): T | null {
  const num = card.cardNumber.trim().toUpperCase();
  const parallel = isParallelRarity(card.rarity);
  let cands = rows.filter((r) => r.cardNumber === num && PARALLEL_NAME.test(r.name) === parallel);
  const want = TCG_BASE[card.rarity.trim().toUpperCase().replace(/[\s-]/g, '')];
  if (want && cands.some((r) => r.rarity === want)) cands = cands.filter((r) => r.rarity === want);
  if (!cands.length) return null;
  const home = num.split('-')[0].replace(/[\s-]/g, '');
  const isHome = (r: T) => (r.groupAbbr ?? '').toUpperCase().replace(/[\s-]/g, '') === home;
  const subPref = (r: T) => (r.subTypeName === (parallel ? 'Foil' : 'Normal') ? 0 : 1);
  return [...cands].sort((a, b) =>
    Number(isHome(b)) - Number(isHome(a))
    || tcgTags(a.name) - tcgTags(b.name)
    || subPref(a) - subPref(b)
    || a.productId - b.productId,
  )[0];
}


// ------------------------------------------------------------------
// Dorasuta (backup for Japanese cards Yuyu-tei doesn't list)
// ------------------------------------------------------------------

/** OP-Vault rarity → Dorasuta label. Seen on real pages: SEC, SEC/パラレル,
 *  SR, SR/パラレル (super parallels are "SEC/スーパーパラレル", never auto-picked).
 *  The rest follow the same "<base>/パラレル" pattern; a wrong guess just means
 *  "no match", fixable from the Dorasuta tab or a pasted link. */
const DORASUTA_MAP: Record<string, string> = {
  C: 'C', UC: 'UC', R: 'R', SR: 'SR', SEC: 'SEC', L: 'L', LEADER: 'L',
  PC: 'C/パラレル', PUC: 'UC/パラレル', PR: 'R/パラレル', PSR: 'SR/パラレル', PSEC: 'SEC/パラレル', PL: 'L/パラレル',
};

export function toDorasutaRarity(rarity: string): string | null {
  return DORASUTA_MAP[normRarity(rarity)] ?? null;
}

/** "[illust.x]", "[漫画コマ]", "【For Asia】", "[NOT FOR SALE]" mark special versions. */
const specialTags = (name: string) => (name.match(/\[[^\]]*\]|【[^】]*】/g) ?? []).length;

/**
 * Default Dorasuta listing: same number and mapped rarity, the plainest name
 * (no alternate-art / promo tags), then the oldest product id.
 */
export function pickDorasutaListing<T extends ListingLike>(
  card: { cardNumber: string; rarity: string },
  listings: T[],
): T | null {
  const want = toDorasutaRarity(card.rarity);
  if (!want) return null;
  const num = card.cardNumber.trim().toUpperCase();
  const pid = (k: string) => Number(k.replace(/\D/g, '')) || 0;
  const candidates = listings.filter((l) => l.cardNumber === num && l.rarity === want);
  if (!candidates.length) return null;
  return [...candidates].sort((a, b) =>
    specialTags(a.name) - specialTags(b.name) || pid(a.listingKey) - pid(b.listingKey),
  )[0];
}
