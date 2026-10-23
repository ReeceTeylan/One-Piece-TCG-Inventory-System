import { readFileSync } from 'fs';
import { join } from 'path';
import { parseCardrushSearch } from './cardrush.parser';
import { gradedCopies, gradeText, groupPrice, pickSlabCopy, sameGroup } from './slab-match';

// Graded copies from the real Cardrush search for "op01 001" (Oct 2026).
const rows = parseCardrushSearch(readFileSync(join(__dirname, '__fixtures__', 'cardrush-op01-001.html'), 'utf8'));
const copies = gradedCopies(rows);
const key = (c: { row: { listingKey: string } } | null) => c?.row.listingKey ?? null;

describe('gradedCopies', () => {
  it('keeps clean graded copies only (no 〔※状態難〕, no ungraded or worn copies)', () => {
    expect(copies.map((c) => `${c.row.listingKey} ${c.company}${c.grade}`).sort()).toEqual([
      'cardrush:14941 PSA9', 'cardrush:2283 PSA10', 'cardrush:2573 PSA10', 'cardrush:4514 ARS10',
      'cardrush:4804 ARS10+', 'cardrush:5842 PSA10', 'cardrush:7358 BGS10',
    ]);
  });
  it('slab grades read the way Cardrush writes them', () => {
    expect(gradeText('10.0')).toBe('10');
    expect(gradeText(9.5)).toBe('9.5');
    expect(gradeText(null)).toBeNull();
  });
});

describe('pickSlabCopy (automatic link only when certain)', () => {
  it('PSA 10 parallel: no plain parallel exists (only manga art), so the owner picks', () => {
    expect(pickSlabCopy({ cardNumber: 'OP01-001', rarity: 'PL', gradingCompany: 'PSA', grade: 10 }, copies)).toBeNull();
  });
  it('PSA 10 leader: two versions (manga background, gold letters), so the owner picks', () => {
    expect(pickSlabCopy({ cardNumber: 'OP01-001', rarity: 'Leader', gradingCompany: 'PSA', grade: 10 }, copies)).toBeNull();
  });
  it('never crosses company or grade', () => {
    expect(pickSlabCopy({ cardNumber: 'OP01-001', rarity: 'PL', gradingCompany: 'CGC', grade: 10 }, copies)).toBeNull();
    expect(pickSlabCopy({ cardNumber: 'OP01-001', rarity: 'PL', gradingCompany: 'PSA', grade: 8 }, copies)).toBeNull();
  });
  it('links when exactly one plain version matches', () => {
    const plain = gradedCopies([
      { listingKey: 'cardrush:900', cardNumber: 'OP01-003', name: '〔PSA10鑑定済〕モンキー・D・ルフィ(パラレル)【L/P】{OP01-003}', priceJpy: 90000, inStock: false, url: 'u' },
      { listingKey: 'cardrush:950', cardNumber: 'OP01-003', name: '〔PSA10鑑定済〕モンキー・D・ルフィ(パラレル)【L/P】{OP01-003}', priceJpy: 85000, inStock: true, url: 'u' },
      { listingKey: 'cardrush:960', cardNumber: 'OP01-003', name: '〔PSA9鑑定済〕モンキー・D・ルフィ(パラレル)【L/P】{OP01-003}', priceJpy: 30000, inStock: true, url: 'u' },
    ]);
    expect(key(pickSlabCopy({ cardNumber: 'op01-003', rarity: 'PL', gradingCompany: 'psa', grade: '10.0' }, plain))).toBe('cardrush:950');
  });
});

describe('groupPrice (lower of last sold and lowest listed)', () => {
  it('uses only identical copies: same version, company and grade', () => {
    const psa10Parallel = copies.find((c) => c.row.listingKey === 'cardrush:2573')!;
    const group = sameGroup(psa10Parallel, copies);
    expect(group.map((c) => c.row.listingKey)).toEqual(['cardrush:2573']); // the 〔※状態難〕 copy 2776 is excluded
    expect(groupPrice(group)).toEqual({ lastSoldJpy: 49800, lowestListedJpy: null, priceJpy: 49800, basis: 'sold', copies: 1 });
  });
  it('takes the newest sold-out copy as "last sold" and the cheaper of the two', () => {
    const g = gradedCopies([
      { listingKey: 'cardrush:100', cardNumber: 'X-001', name: '〔PSA10鑑定済〕A【SR】{X-001}', priceJpy: 9000, inStock: false, url: 'u' },
      { listingKey: 'cardrush:300', cardNumber: 'X-001', name: '〔PSA10鑑定済〕A【SR】{X-001}', priceJpy: 12000, inStock: false, url: 'u' },
      { listingKey: 'cardrush:200', cardNumber: 'X-001', name: '〔PSA10鑑定済〕A【SR】{X-001}', priceJpy: 11000, inStock: true, url: 'u' },
    ]);
    expect(groupPrice(g)).toEqual({ lastSoldJpy: 12000, lowestListedJpy: 11000, priceJpy: 11000, basis: 'listed', copies: 3 });
  });
});
