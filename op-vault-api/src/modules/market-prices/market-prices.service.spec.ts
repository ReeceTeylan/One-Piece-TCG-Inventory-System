import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { RawCardsService } from '../raw-cards/raw-cards.service';
import { MarketPricesModule } from './market-prices.module';
import { MarketPricesService } from './market-prices.service';

const card = (over: Partial<any>) => ({
  id: 'c1', name: 'Card', cardNumber: 'OP01-120', rarity: 'SEC', setName: 'OP01', quantity: 1,
  postedPrice: new Prisma.Decimal(100), buyCost: new Prisma.Decimal(50), createdAt: new Date('2026-10-01'),
  marketListingKey: null, notes: null, images: [], ...over,
});

const CARDS = [
  card({ id: 'jp', name: 'Shanks JP', postedPrice: new Prisma.Decimal(100) }),
  card({ id: 'jpDamaged', name: 'Shanks JP whites', postedPrice: new Prisma.Decimal(100), notes: 'light whites' }),
  card({ id: 'en', name: 'Zoro EN', cardNumber: 'OP01-001', rarity: 'PL', postedPrice: new Prisma.Decimal(30000), notes: 'ENG' }),
];
const YUYUTEI = [
  { listingKey: 'op01/10150', source: 'YUYUTEI', cardNumber: 'OP01-120', rarity: 'SEC', name: 'シャンクス(刻印なし)',
    priceJpy: 320, prevPriceJpy: 300, priceChangedAt: new Date(), // moved ¥300 → ¥320 at the last sync
    inStock: true, stockCount: 6, url: 'u', fetchedAt: new Date() },
];
const TCG = [
  { listingKey: 'tcgp:454513:Foil', productId: 454513, subTypeName: 'Foil', cardNumber: 'OP01-001', rarity: 'L',
    name: 'Roronoa Zoro (001) (Parallel)', groupId: 3188, groupAbbr: 'OP01', priceUsd: new Prisma.Decimal('660.39'),
    prevPriceUsd: null, priceChangedAt: null, url: 'u', imageUrl: null, fetchedAt: new Date() },
];

describe('MarketPricesService', () => {
  let service: MarketPricesService;
  let prisma: any;
  let stamp: Record<string, unknown>;
  const rawUpdate = jest.fn().mockResolvedValue({});

  beforeEach(async () => {
    rawUpdate.mockClear();
    stamp = { rc_at: '2026-10-21T07:00:00Z', rc_n: BigInt(3) };
    prisma = {
      $queryRaw: jest.fn(() => Promise.resolve([stamp])), // the cache fingerprint
      $transaction: jest.fn((ops: any[]) => Promise.all(ops)),
      priceHistory: { createMany: jest.fn((a: any) => Promise.resolve({ count: a.data.length })) },
      rawCard: {
        findMany: jest.fn().mockResolvedValue(CARDS),
        findUnique: jest.fn(({ where }: any) => Promise.resolve(CARDS.find((c) => c.id === where.id) ?? null)),
        update: jest.fn((a: any) => Promise.resolve(a)),
      },
      marketPrice: { findMany: jest.fn().mockResolvedValue(YUYUTEI) },
      tcgplayerPrice: { findMany: jest.fn().mockResolvedValue(TCG) },
    };
    const settings = { getAll: jest.fn().mockResolvedValue({
      jpyToPhpRate: 0.38, jpyToPhpRateDamaged: 0.3, usdToPhpRate: 58, usdToPhpRateDamaged: null, underpricedPct: 90,
    }) };

    @Global()
    @Module({
      providers: [
        { provide: PrismaService, useValue: prisma },
        { provide: SettingsService, useValue: settings },
        { provide: ActivityLogsService, useValue: { log: jest.fn() } },
      ],
      exports: [PrismaService, SettingsService, ActivityLogsService],
    })
    class FakeGlobals {}

    const mod = await Test.createTestingModule({ imports: [FakeGlobals, MarketPricesModule] })
      .overrideProvider(RawCardsService).useValue({ update: rawUpdate })
      .compile();
    service = mod.get(MarketPricesService);
  });

  it('prices Japanese, damaged and English cards from the right source and rate', async () => {
    const res = await service.list({ page: 1, limit: 50, skip: 0, view: 'all' } as any);
    const by = Object.fromEntries(res.data.map((r) => [r.id, r]));
    // 320 yen × 0.38 = 121.6 → ₱122, rounded match ₱120
    expect(by.jp).toMatchObject({ language: 'JP', marketPhp: 122, matchPrice: 120, underpriced: true, damage: null });
    // damaged rate 0.30: 320 × 0.30 = ₱96 → rounds to ₱100, same as posted, so nothing to match
    expect(by.jpDamaged).toMatchObject({ damage: 'whites', rateUsed: 0.3, marketPhp: 96, matchPrice: null });
    // English parallel: $660.39 × 58 = ₱38,303 → match ₱38,300
    expect(by.en).toMatchObject({ language: 'EN', marketPhp: 38303, matchPrice: 38300, underpriced: true });
    expect(by.en.listing).toMatchObject({ source: 'TCGPLAYER', currency: 'USD', price: 660.39 });
    expect(res.summary.matchableUnderpriced).toBe(2);
  });

  it('Match one card writes the rounded market price through RawCardsService', async () => {
    const r = await service.matchOne('jp', 'user1');
    expect(r).toEqual({ id: 'jp', from: 100, to: 120, changed: true });
    expect(rawUpdate).toHaveBeenCalledWith('jp', { postedPrice: 120 });
  });

  it('Match all underpriced raises only underpriced cards, in one batched transaction', async () => {
    const r = await service.matchAllUnderpriced('user1');
    expect(r.updated).toBe(2);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.rawCard.update.mock.calls.map((c: any) => [c[0].where.id, Number(c[0].data.postedPrice)]).sort())
      .toEqual([['en', 38300], ['jp', 120]]);
    expect(prisma.priceHistory.createMany.mock.calls[0][0].data.map((h: any) => [h.itemId, Number(h.oldValue), Number(h.newValue)]).sort())
      .toEqual([['en', 30000, 38300], ['jp', 100, 120]]);
  });

  it('reuses the priced list until the fingerprint changes', async () => {
    await service.list({ page: 1, limit: 50, skip: 0, view: 'all' } as any);
    await service.list({ page: 1, limit: 50, skip: 0, view: 'all', sort: 'price_asc' } as any);
    await service.rawInventoryValue();
    expect(prisma.rawCard.findMany).toHaveBeenCalledTimes(1);
    stamp = { ...stamp, rc_at: '2026-10-21T08:00:00Z' }; // e.g. a sale changed a card
    await service.list({ page: 1, limit: 50, skip: 0, view: 'all' } as any);
    expect(prisma.rawCard.findMany).toHaveBeenCalledTimes(2);
  });

  it('search matches names and card numbers typed with spaces or dashes', async () => {
    const byNumber = await service.list({ page: 1, limit: 50, skip: 0, view: 'all', search: 'op01 120' } as any);
    expect(byNumber.data.map((r) => r.id).sort()).toEqual(['jp', 'jpDamaged']);
    const byName = await service.list({ page: 1, limit: 50, skip: 0, view: 'all', search: 'zoro' } as any);
    expect(byName.data.map((r) => r.id)).toEqual(['en']);
    expect(byName.summary.cards).toBe(1);
  });

  it('default view shows only cards whose price moved, with the peso change', async () => {
    const res = await service.list({ page: 1, limit: 50, skip: 0 } as any);
    // ¥300 → ¥320: normal card at 0.38 → ₱122 − ₱114 = +₱8; damaged at 0.30 → ₱96 − ₱90 = +₱6
    expect(res.data.map((r) => [r.id, r.changePhp])).toEqual([['jp', 8], ['jpDamaged', 6]]);
    expect(res.summary.changed).toBe(2);
  });

  it('filters by language and condition', async () => {
    const en = await service.list({ page: 1, limit: 50, skip: 0, view: 'all', language: 'EN' } as any);
    expect(en.data.map((r) => r.id)).toEqual(['en']);
    const issues = await service.list({ page: 1, limit: 50, skip: 0, view: 'all', condition: 'issues' } as any);
    expect(issues.data.map((r) => r.id)).toEqual(['jpDamaged']);
  });

  it('sorts by market price and by margin', async () => {
    const hi = await service.list({ page: 1, limit: 50, skip: 0, view: 'all', sort: 'price_desc' } as any);
    expect(hi.data.map((r) => r.id)).toEqual(['en', 'jp', 'jpDamaged']);
    const lo = await service.list({ page: 1, limit: 50, skip: 0, view: 'all', sort: 'price_asc' } as any);
    expect(lo.data.map((r) => r.id)).toEqual(['jpDamaged', 'jp', 'en']);
    // margins vs ₱50 cost: en (38303−50)/38303 ≈ 99.9%, jp (122−50)/122 = 59%, damaged (96−50)/96 = 47.9%
    const margin = await service.list({ page: 1, limit: 50, skip: 0, view: 'all', sort: 'margin_desc' } as any);
    expect(margin.data.map((r) => [r.id, r.marginPct])).toEqual([['en', 99.9], ['jp', 59], ['jpDamaged', 47.9]]);
  });

  it('raw inventory value = market × qty, 80% of posted when no market price', async () => {
    const v = await service.rawInventoryValue();
    expect(v).toEqual({ total: 122 + 96 + 38303, market: 122 + 96 + 38303, fallback: 0, matchedCards: 3, fallbackCards: 0 });
  });
});

describe('changeFields', () => {
  const { changeFields } = jest.requireActual('./market-prices.service');
  const at = new Date('2026-10-22T03:00:00Z');
  it('records the old price only when it actually changed', () => {
    expect(changeFields(300, 320, 'prevPriceJpy', at)).toEqual({ prevPriceJpy: 300, priceChangedAt: at });
    expect(changeFields(320, 320, 'prevPriceJpy', at)).toEqual({});
    expect(changeFields(undefined, 320, 'prevPriceJpy', at)).toEqual({});
    expect(changeFields(1.67, 1.67, 'prevPriceUsd', at)).toEqual({});
  });
});

