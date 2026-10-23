/**
 * Pure rules for pricing graded slabs from Cardrush's graded copies
 * (〔PSA10鑑定済〕… in the product name). No DB or network access.
 */
import { parseCardrushName } from './cardrush.parser';
import { toCardrushRarity } from './market-match';

export interface GradedRow {
  listingKey: string;     // "cardrush:<pid>"
  cardNumber: string;
  name: string;
  priceJpy: number;
  inStock: boolean;
  url: string;
}

export interface GradedCopy<T extends GradedRow = GradedRow> {
  row: T;
  pid: number;
  company: string;        // "PSA", "BGS", "CGC", "ARS"…
  grade: string;          // "10", "9.5", "10+"
  rarity: string;         // Cardrush label: "L", "L/P"
  tags: string[];         // version tags: ["パラレル", "漫画絵"]
  version: string;        // rarity + tags, the "same printing" key
}

const normCompany = (c: string) => {
  const u = c.trim().toUpperCase();
  return u === 'BECKETT' ? 'BGS' : u;
};
/** Slab grade (Decimal 10.0 / 9.5) → Cardrush's text ("10", "9.5"). */
export const gradeText = (g: unknown) => {
  const n = Number(g);
  return Number.isFinite(n) && n > 0 ? String(n) : null;
};

/** Graded, issue-free Cardrush copies (〔※状態難/…〕 = problem with the slab or card, skipped). */
export function gradedCopies<T extends GradedRow>(rows: T[]): GradedCopy<T>[] {
  const out: GradedCopy<T>[] = [];
  for (const row of rows) {
    const n = parseCardrushName(row.name);
    if (!n?.grade || n.grade.issues || n.condition) continue;
    out.push({
      row, pid: Number(row.listingKey.replace(/\D/g, '')) || 0,
      company: normCompany(n.grade.company), grade: n.grade.grade,
      rarity: n.rarity, tags: n.tags, version: `${n.rarity}|${[...n.tags].sort().join('/')}`,
    });
  }
  return out;
}

/** The copies that price the same thing as `copy`: same number, version, company and grade. */
export function sameGroup<T extends GradedRow>(copy: GradedCopy<T>, all: GradedCopy<T>[]) {
  return all.filter((c) => c.row.cardNumber === copy.row.cardNumber && c.version === copy.version
    && c.company === copy.company && c.grade === copy.grade);
}

/**
 * Slab price from a group of identical graded copies: the lower of
 * "last sold" (the newest sold-out copy, by product id) and "lowest listed"
 * (the cheapest copy in stock).
 */
export function groupPrice(group: GradedCopy[]) {
  const sold = group.filter((c) => !c.row.inStock).sort((a, b) => b.pid - a.pid)[0];
  const listed = group.filter((c) => c.row.inStock).sort((a, b) => a.row.priceJpy - b.row.priceJpy)[0];
  const lastSoldJpy = sold?.row.priceJpy ?? null;
  const lowestListedJpy = listed?.row.priceJpy ?? null;
  const values = [lastSoldJpy, lowestListedJpy].filter((v): v is number => v !== null);
  return {
    lastSoldJpy, lowestListedJpy,
    priceJpy: values.length ? Math.min(...values) : null,
    basis: values.length ? (lowestListedJpy !== null && lowestListedJpy <= (lastSoldJpy ?? Infinity) ? 'listed' as const : 'sold' as const) : null,
    copies: group.length,
  };
}

/** Does a graded copy have the slab's company and grade? */
export const sameGrade = (c: GradedCopy, slab: { gradingCompany: string | null; grade: unknown }) =>
  !!slab.gradingCompany && c.company === normCompany(slab.gradingCompany) && c.grade === gradeText(slab.grade);

/**
 * Automatic link, only when it's certain: same card number, company and
 * grade; the slab's rarity (parallel or not) when it's set; and the plain
 * version only (no manga / gold-letter / sealed tags beyond "パラレル").
 * Returns the newest copy of that group, or null to let the owner pick.
 */
export function pickSlabCopy<T extends GradedRow>(
  slab: { cardNumber: string | null; rarity: string | null; gradingCompany: string | null; grade: unknown },
  copies: GradedCopy<T>[],
): GradedCopy<T> | null {
  const num = slab.cardNumber?.trim().toUpperCase();
  if (!num) return null;
  const want = slab.rarity ? toCardrushRarity(slab.rarity) : null;
  if (slab.rarity && !want) return null; // e.g. "Don": can't map, owner picks
  const cands = copies.filter((c) => c.row.cardNumber === num && sameGrade(c, slab)
    && (want ? c.rarity === want : true)
    && c.tags.every((t) => t === 'パラレル'));
  // One version only (rarity is part of it, so base vs parallel can't be mixed up).
  const versions = new Set(cands.map((c) => c.version));
  if (versions.size !== 1) return null;
  return [...cands].sort((a, b) => b.pid - a.pid)[0];
}
