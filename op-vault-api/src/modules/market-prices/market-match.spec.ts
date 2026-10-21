import { comparePrice, pickAutoListing, toYuyuteiRarity } from './market-match';

// Listings as parsed from the real Yuyu-tei OP01-120 and OP01-001 pages (Oct 2026).
const OP01_120 = [
  { listingKey: 'prb01/10023', cardNumber: 'OP01-120', rarity: 'P-SEC', name: 'シャンクス(パラレル)(PRB)' },
  { listingKey: 'prb01/10024', cardNumber: 'OP01-120', rarity: 'P-SEC', name: 'シャンクス(パラレル)(スーパーパラレル)(刻印あり)' },
  { listingKey: 'op01/10151', cardNumber: 'OP01-120', rarity: 'P-SEC', name: 'シャンクス(パラレル)' },
  { listingKey: 'op01/10152', cardNumber: 'OP01-120', rarity: 'P-SEC', name: 'シャンクス(パラレル)(スーパーパラレル)(刻印なし)' },
  { listingKey: 'prb01/10022', cardNumber: 'OP01-120', rarity: 'SEC', name: 'シャンクス(刻印あり)' },
  { listingKey: 'op01/10150', cardNumber: 'OP01-120', rarity: 'SEC', name: 'シャンクス(刻印なし)' },
];
const OP01_001 = [
  { listingKey: 'op01/10002', cardNumber: 'OP01-001', rarity: 'P-L', name: 'ロロノア・ゾロ(パラレル)' },
  { listingKey: 'op01/10001', cardNumber: 'OP01-001', rarity: 'L', name: 'ロロノア・ゾロ' },
  { listingKey: 'promo-op10/10001', cardNumber: 'OP01-001', rarity: 'L', name: 'ロロノア・ゾロ(パラレル)' },
  { listingKey: 'promo-op10/10083', cardNumber: 'OP01-001', rarity: 'L', name: 'ロロノア・ゾロ(パラレル/箔押し)(LECAFIG)' },
];

describe('toYuyuteiRarity', () => {
  it('maps OP-Vault codes to Yuyu-tei labels', () => {
    expect(toYuyuteiRarity('PSEC')).toBe('P-SEC');
    expect(toYuyuteiRarity('Leader')).toBe('L');
    expect(toYuyuteiRarity('PL')).toBe('P-L');
    expect(toYuyuteiRarity(' psr ')).toBe('P-SR');
    expect(toYuyuteiRarity('Don')).toBeNull();
  });
});

describe('pickAutoListing', () => {
  it('SEC picks the original OP01 printing, not the PRB reprint', () => {
    expect(pickAutoListing({ cardNumber: 'OP01-120', rarity: 'SEC' }, OP01_120)?.listingKey).toBe('op01/10150');
  });
  it('PSEC picks the plain parallel, not super parallel or PRB', () => {
    expect(pickAutoListing({ cardNumber: 'op01-120', rarity: 'PSEC' }, OP01_120)?.listingKey).toBe('op01/10151');
  });
  it('Leader picks the base OP01 leader, not promo parallels listed under L', () => {
    expect(pickAutoListing({ cardNumber: 'OP01-001', rarity: 'Leader' }, OP01_001)?.listingKey).toBe('op01/10001');
  });
  it('PL picks the parallel leader', () => {
    expect(pickAutoListing({ cardNumber: 'OP01-001', rarity: 'PL' }, OP01_001)?.listingKey).toBe('op01/10002');
  });
  it('returns null when nothing matches', () => {
    expect(pickAutoListing({ cardNumber: 'OP01-120', rarity: 'SR' }, OP01_120)).toBeNull();
    expect(pickAutoListing({ cardNumber: 'OP01-120', rarity: 'Don' }, OP01_120)).toBeNull();
  });
});

describe('comparePrice', () => {
  it('converts yen and flags below the threshold', () => {
    // 3,980 yen at 0.38 = 1,512 PHP; 90% of that = 1,360.8
    expect(comparePrice(1300, 3980, 0.38, 90)).toEqual({ marketPhp: 1512, diffPct: -14, underpriced: true });
    expect(comparePrice(1400, 3980, 0.38, 90)).toEqual({ marketPhp: 1512, diffPct: -7.4, underpriced: false });
  });
  it('returns nulls when no rate is set', () => {
    expect(comparePrice(1300, 3980, null, 90)).toEqual({ marketPhp: null, diffPct: null, underpriced: false });
  });
});

import { damageReason, isEnglish, isParallelRarity, pickTcgListing, roundPrice } from './market-match';

describe('notes rules', () => {
  it('detects English printings', () => {
    expect(isEnglish('ENG')).toBe(true);
    expect(isEnglish('english version, NM')).toBe(true);
    expect(isEnglish('Eng.')).toBe(true);
    expect(isEnglish('engraved sleeve')).toBe(false);
    expect(isEnglish(null)).toBe(false);
  });
  it('detects damage words but not negations', () => {
    expect(damageReason('minor whites on back')).toBe('whites');
    expect(damageReason('small DENT top left')).toBe('dent');
    expect(damageReason('light scratch')).toBe('scratch');
    expect(damageReason('has issue on corner')).toBe('issue');
    expect(damageReason('no whites, mint')).toBeNull();
    expect(damageReason('pack fresh, no issues')).toBeNull();
    expect(damageReason('whitewash art')).toBeNull();
  });
  it('rounds like the web app', () => {
    expect(roundPrice(1512)).toBe(1510);
    expect(roundPrice(1515)).toBe(1520);
    expect(roundPrice(48640)).toBe(48600);
    expect(roundPrice(4996)).toBe(5000);
  });
  it('knows parallel rarity codes', () => {
    expect(isParallelRarity('PSEC')).toBe(true);
    expect(isParallelRarity('PL')).toBe(true);
    expect(isParallelRarity('Promo')).toBe(false);
    expect(isParallelRarity('SP')).toBe(false);
  });
});

// Zoro rows and the PRB-01 Shanks are real TCGCSV data (category 68, Oct 2026).
// The two OP01 Shanks rows (4546xx) are illustrative stand-ins in the same format.
const TCG = [
  { listingKey: 'tcgp:454512:Normal', productId: 454512, subTypeName: 'Normal', cardNumber: 'OP01-001', rarity: 'L', name: 'Roronoa Zoro (001)', groupAbbr: 'OP01' },
  { listingKey: 'tcgp:454513:Foil', productId: 454513, subTypeName: 'Foil', cardNumber: 'OP01-001', rarity: 'L', name: 'Roronoa Zoro (001) (Parallel)', groupAbbr: 'OP01' },
  { listingKey: 'tcgp:586194:Foil', productId: 586194, subTypeName: 'Foil', cardNumber: 'OP01-120', rarity: 'SEC', name: 'Shanks (OP01-120) (Alternate Art)', groupAbbr: 'PRB-01' },
  { listingKey: 'tcgp:454600:Foil', productId: 454600, subTypeName: 'Foil', cardNumber: 'OP01-120', rarity: 'SEC', name: 'Shanks (120)', groupAbbr: 'OP01' },
  { listingKey: 'tcgp:454601:Foil', productId: 454601, subTypeName: 'Foil', cardNumber: 'OP01-120', rarity: 'SEC', name: 'Shanks (120) (Parallel)', groupAbbr: 'OP01' },
];

describe('pickTcgListing', () => {
  it('Leader picks the base card, PL picks the parallel', () => {
    expect(pickTcgListing({ cardNumber: 'OP01-001', rarity: 'Leader' }, TCG)?.productId).toBe(454512);
    expect(pickTcgListing({ cardNumber: 'OP01-001', rarity: 'PL' }, TCG)?.productId).toBe(454513);
  });
  it('PSEC prefers the original set over the PRB alternate art', () => {
    expect(pickTcgListing({ cardNumber: 'OP01-120', rarity: 'PSEC' }, TCG)?.productId).toBe(454601);
    expect(pickTcgListing({ cardNumber: 'OP01-120', rarity: 'SEC' }, TCG)?.productId).toBe(454600);
  });
  it('returns null when no product has the number', () => {
    expect(pickTcgListing({ cardNumber: 'OP02-001', rarity: 'L' }, TCG)).toBeNull();
  });
});
