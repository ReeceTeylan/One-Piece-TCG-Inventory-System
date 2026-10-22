import { readFileSync } from 'fs';
import { join } from 'path';
import { isDorasutaBuyUrl, parseDorasutaProductUrl, parseDorasutaSearch } from './dorasuta.parser';
import { pickDorasutaListing, toDorasutaRarity } from './market-match';

// Item list from the real Dorasuta search for OP08-084 (Oct 2026).
const html = readFileSync(join(__dirname, '__fixtures__', 'dorasuta-op08-084.html'), 'utf8');

describe('parseDorasutaSearch', () => {
  const rows = parseDorasutaSearch(html);

  it('keeps one normal-condition row per product, skipping played and sale copies', () => {
    expect(rows.map((r) => [r.listingKey, r.rarity, r.priceJpy, r.stockCount])).toEqual([
      ['dorasuta:568180', 'SR/パラレル', 3500, 5],
      ['dorasuta:541696', 'SR/パラレル', 800, 11],   // not the ¥640 played or ¥555 sale copy
      ['dorasuta:577849', 'SR/パラレル', 1000, 0],   // For Asia, sold out
      ['dorasuta:541695', 'SR', 200, 27],           // not the ¥140 played copy
    ]);
  });

  it('reads the card number, stock and links', () => {
    expect(rows.every((r) => r.cardNumber === 'OP08-084')).toBe(true);
    expect(rows.find((r) => r.listingKey === 'dorasuta:577849')).toMatchObject({ inStock: false });
    expect(rows[1]).toMatchObject({
      name: 'ジャック(★SR/パラレル)(OP08-084)', inStock: true,
      url: 'https://dorasuta.jp/onepiece-cardgame/product?pid=541696',
    });
    expect(rows[1].imageUrl).toMatch(/^https:\/\/dorasuta\.jp\/contents\/product\//);
  });

  it('auto-picks the plain version: SR → base card, PSR → parallel without illust/For Asia tags', () => {
    expect(pickDorasutaListing({ cardNumber: 'op08-084', rarity: 'SR' }, rows)?.listingKey).toBe('dorasuta:541695');
    expect(pickDorasutaListing({ cardNumber: 'OP08-084', rarity: 'PSR' }, rows)?.listingKey).toBe('dorasuta:541696');
    expect(pickDorasutaListing({ cardNumber: 'OP08-084', rarity: 'SEC' }, rows)).toBeNull();
    expect(pickDorasutaListing({ cardNumber: 'OP08-084', rarity: 'Don' }, rows)).toBeNull();
  });
});

describe('Dorasuta links and rarities', () => {
  it('accepts shop product links only', () => {
    expect(parseDorasutaProductUrl(' https://dorasuta.jp/onepiece-cardgame/product?pid=541696 ')).toEqual({
      pid: '541696', listingKey: 'dorasuta:541696', url: 'https://dorasuta.jp/onepiece-cardgame/product?pid=541696',
    });
    expect(parseDorasutaProductUrl('https://buy.dorasuta.jp/onepiece-cardgame/product?pid=559715')).toBeNull();
    expect(parseDorasutaProductUrl('https://dorasuta.jp.evil.example/onepiece-cardgame/product?pid=1')).toBeNull();
    expect(isDorasutaBuyUrl('https://buy.dorasuta.jp/onepiece-cardgame/product?pid=559715')).toBe(true);
  });
  it('maps OP-Vault rarities to Dorasuta labels', () => {
    expect(toDorasutaRarity('PSEC')).toBe('SEC/パラレル');
    expect(toDorasutaRarity('Leader')).toBe('L');
    expect(toDorasutaRarity('Don')).toBeNull();
  });
});
