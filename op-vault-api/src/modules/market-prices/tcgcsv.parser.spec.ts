import { joinGroup } from './tcgcsv.parser';

// Real values from TCGCSV group 3188 (Romance Dawn / OP01), Oct 2026.
const group = { groupId: 3188, name: 'Romance Dawn', abbreviation: 'OP01' };
const products = [
  { productId: 450086, name: 'Romance Dawn Booster Box', url: 'https://www.tcgplayer.com/product/450086', extendedData: [] },
  { productId: 454512, name: 'Roronoa Zoro (001)', url: 'https://www.tcgplayer.com/product/454512',
    extendedData: [{ name: 'Rarity', value: 'L' }, { name: 'Number', value: 'OP01-001' }] },
  { productId: 454513, name: 'Roronoa Zoro (001) (Parallel)', url: 'https://www.tcgplayer.com/product/454513',
    extendedData: [{ name: 'Rarity', value: 'L' }, { name: 'Number', value: 'OP01-001' }] },
  { productId: 453505, name: 'Trafalgar Law (002)', url: 'https://www.tcgplayer.com/product/453505',
    extendedData: [{ name: 'Rarity', value: 'L' }, { name: 'Number', value: 'OP01-002' }] },
];
const prices = [
  { productId: 450086, lowPrice: 4719.96, midPrice: 6250, marketPrice: 4636.13, subTypeName: 'Normal' },
  { productId: 454512, lowPrice: 1.67, midPrice: 3.23, marketPrice: 1.67, subTypeName: 'Normal' },
  { productId: 454513, lowPrice: 689.99, midPrice: 748.98, marketPrice: 660.39, subTypeName: 'Foil' },
  { productId: 453505, lowPrice: 1.02, midPrice: 2.5, marketPrice: 1.68, subTypeName: 'Normal' },
];

describe('joinGroup', () => {
  it('keeps only wanted card numbers, skips sealed, uses market price', () => {
    const rows = joinGroup(group, products, prices, new Set(['OP01-001']));
    expect(rows.map((r) => [r.listingKey, r.priceUsd, r.rarity, r.groupAbbr])).toEqual([
      ['tcgp:454512:Normal', 1.67, 'L', 'OP01'],
      ['tcgp:454513:Foil', 660.39, 'L', 'OP01'],
    ]);
  });
  it('falls back to mid then low when market price is missing', () => {
    const rows = joinGroup(group, products,
      [{ productId: 453505, lowPrice: 1.02, midPrice: 2.5, marketPrice: null, subTypeName: 'Normal' }],
      new Set(['OP01-002']));
    expect(rows[0].priceUsd).toBe(2.5);
  });
});
