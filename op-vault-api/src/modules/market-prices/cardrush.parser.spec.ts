import { readFileSync } from 'fs';
import { join } from 'path';
import { cardrushKeyword, parseCardrushName, parseCardrushProductUrl, parseCardrushSearch } from './cardrush.parser';
import { pickCardrushListing, toCardrushRarity } from './market-match';

// Item list from the real Cardrush search for "op01 001" (Oct 2026): 31 products.
const html = readFileSync(join(__dirname, '__fixtures__', 'cardrush-op01-001.html'), 'utf8');

describe('parseCardrushSearch', () => {
  const rows = parseCardrushSearch(html);
  const by = (pid: number) => rows.find((r) => r.listingKey === `cardrush:${pid}`)!;

  it('reads every card product, skipping the two deck items ({-})', () => {
    expect(rows).toHaveLength(29);
    expect(rows.every((r) => r.cardNumber === 'OP01-001')).toBe(true);
  });

  it('reads price, stock and sold-out copies (which keep their last price)', () => {
    expect(by(170)).toMatchObject({ name: 'ロロノア・ゾロ【L】{OP01-001}', rarity: 'L', priceJpy: 380, inStock: true, stockCount: 5,
      url: 'https://www.cardrush-op.jp/product/170' });
    expect(by(4776)).toMatchObject({ priceJpy: 24800, inStock: false, stockCount: 0 });
    expect(by(169)).toMatchObject({ rarity: 'L/P', priceJpy: 25800, stockCount: 3 });
  });

  it('splits the name into condition, grading, version tags and rarity', () => {
    expect(parseCardrushName(by(1563).name)).toMatchObject({ condition: 'A-', grade: null, tags: ['漫画背景', '漫画絵'], rarity: 'L' });
    expect(parseCardrushName(by(2573).name)).toMatchObject({ condition: null, grade: { company: 'PSA', grade: '10', issues: false }, tags: ['パラレル', '漫画絵'], rarity: 'L/P' });
    expect(parseCardrushName(by(2776).name)?.grade).toEqual({ company: 'PSA', grade: '10', issues: true });   // 〔※状態難/PSA10鑑定済〕
    expect(parseCardrushName(by(4804).name)?.grade).toEqual({ company: 'ARS', grade: '10+', issues: false });
    expect(parseCardrushName(by(7358).name)?.grade).toEqual({ company: 'BGS', grade: '10', issues: false });
    expect(parseCardrushName('赤緑ルフィ【ver1.5】{-} [デッキ販売]')).toBeNull();
  });

  it('auto-picks the standard copy of the plainest version', () => {
    // L: the ¥380 base card, not manga-background, gold-letter, worn, graded or sealed versions.
    expect(pickCardrushListing({ cardNumber: 'op01-001', rarity: 'Leader' }, rows)?.listingKey).toBe('cardrush:170');
    // PL: the ¥25,800 parallel, not the 状態A-/B/C or graded parallels.
    expect(pickCardrushListing({ cardNumber: 'OP01-001', rarity: 'PL' }, rows)?.listingKey).toBe('cardrush:169');
    expect(pickCardrushListing({ cardNumber: 'OP01-001', rarity: 'SEC' }, rows)).toBeNull();
    expect(pickCardrushListing({ cardNumber: 'OP01-001', rarity: 'Don' }, rows)).toBeNull();
  });
});

describe('Cardrush links, search words and rarities', () => {
  it('accepts product links only', () => {
    expect(parseCardrushProductUrl(' https://www.cardrush-op.jp/product/170 ')).toEqual({
      pid: '170', listingKey: 'cardrush:170', url: 'https://www.cardrush-op.jp/product/170',
    });
    expect(parseCardrushProductUrl('https://www.cardrush-op.jp/phone/product/169')?.listingKey).toBe('cardrush:169');
    expect(parseCardrushProductUrl('https://www.cardrush-op.jp/product-list?keyword=op01+001')).toBeNull();
    expect(parseCardrushProductUrl('https://cardrush-op.jp.evil.example/product/1')).toBeNull();
  });
  it('searches the way the verified pages were searched', () => {
    expect(cardrushKeyword('OP01-001')).toBe('op01 001');
  });
  it('maps OP-Vault rarities to Cardrush labels', () => {
    expect(toCardrushRarity('Leader')).toBe('L');
    expect(toCardrushRarity('PL')).toBe('L/P');
    expect(toCardrushRarity('PSEC')).toBe('SEC/P');
    expect(toCardrushRarity('Don')).toBeNull();
  });
});
