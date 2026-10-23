import { readFileSync } from 'fs';
import { join } from 'path';
import { Prisma } from '@prisma/client';
import { parseCardrushSearch } from './cardrush.parser';
import { SlabPricesService } from './slab-prices.service';

// Real Cardrush rows for "op01 001" (Oct 2026), as they'd sit in market_prices.
const ROWS = parseCardrushSearch(readFileSync(join(__dirname, '__fixtures__', 'cardrush-op01-001.html'), 'utf8'))
  .map((r) => ({ ...r, source: 'CARDRUSH', fetchedAt: new Date(), prevPriceJpy: null, priceChangedAt: null }));
const slab = (o: any) => ({ id: 's1', kind: 'SLAB', cardNumber: 'OP01-001', rarity: 'PL', gradingCompany: 'PSA',
  grade: new Prisma.Decimal(10), sellPrice: new Prisma.Decimal(20000), marketListingKey: null, ...o });

describe('SlabPricesService', () => {
  let prisma: any;
  let service: SlabPricesService;
  beforeEach(() => {
    prisma = {
      slabCard: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn((a: any) => Promise.resolve(a)) },
      marketPrice: {
        findMany: jest.fn(({ where }: any) => Promise.resolve(ROWS.filter((r) =>
          (!where.listingKey || where.listingKey.in.includes(r.listingKey))
          && (!where.cardNumber || (typeof where.cardNumber === 'string' ? r.cardNumber === where.cardNumber : where.cardNumber.in.includes(r.cardNumber)))))),
        findUnique: jest.fn(({ where }: any) => Promise.resolve(ROWS.find((r) => r.listingKey === where.listingKey) ?? null)),
      },
      $transaction: jest.fn((ops: any[]) => Promise.all(ops)),
    };
    service = new SlabPricesService(prisma, { getAll: jest.fn().mockResolvedValue({ jpyToPhpRate: 0.38 }) } as any);
  });

  it('prices a linked PSA 10 from identical copies only', async () => {
    prisma.slabCard.findMany.mockResolvedValue([
      slab({ id: 'a', marketListingKey: 'cardrush:2573' }),                                  // PSA 10 parallel (manga)
      slab({ id: 'b', marketListingKey: 'cardrush:2573', grade: new Prisma.Decimal(9) }),    // grade edited after linking
      slab({ id: 'c', marketListingKey: 'none' }),
      slab({ id: 'd' }),
    ]);
    const r = await service.forSlabs();
    // Only cardrush:2573 is that exact version + PSA 10 (2776 is 〔※状態難〕): last sold ¥49,800 × 0.38 = ₱18,924
    expect(r.a).toMatchObject({ linkState: 'linked', gradeLabel: 'PSA 10', priceJpy: 49800, lastSoldJpy: 49800,
      lowestListedJpy: null, basis: 'sold', copies: 1, marketPhp: 18924, diffPct: 5.7 });
    expect(r.b).toMatchObject({ linkState: 'missing', marketPhp: null });
    expect(r.c.linkState).toBe('none');
    expect(r.d.linkState).toBe('new');
  });

  it('link refuses a copy with a different company or grade', async () => {
    prisma.slabCard.findUnique.mockResolvedValue(slab({}));
    await expect(service.link('s1', 'cardrush:14941')).rejects.toThrow('That copy is PSA 9, but this slab is PSA 10.');
    await expect(service.link('s1', 'cardrush:170')).rejects.toThrow(/isn't a graded copy/);
    await expect(service.link('s1', 'cardrush:2573')).resolves.toEqual({ id: 's1', marketListingKey: 'cardrush:2573' });
  });

  it('picker lists graded copies with the matching grade first', async () => {
    const list = await service.copiesFor(slab({}), 'op01-001');
    expect(list.filter((c) => c.sameGrade).map((c) => c.listingKey).sort()).toEqual(['cardrush:2283', 'cardrush:2573', 'cardrush:5842']);
    expect(list[0].sameGrade).toBe(true);
    expect(list.some((c) => c.listingKey === 'cardrush:2776')).toBe(false); // 〔※状態難〕 never offered
  });

  it('automatic link skips ambiguous slabs (two PSA 10 versions of the leader)', async () => {
    const r = await service.autoLink([
      { id: 'leader', cardNumber: 'OP01-001', rarity: 'Leader', gradingCompany: 'PSA', grade: new Prisma.Decimal(10) },
      { id: 'nonum', cardNumber: null, rarity: 'SEC', gradingCompany: 'PSA', grade: new Prisma.Decimal(10) },
    ]);
    expect(r).toMatchObject({ linked: 0, unmatched: 2 });
    expect(prisma.slabCard.update).not.toHaveBeenCalled();
  });
});
