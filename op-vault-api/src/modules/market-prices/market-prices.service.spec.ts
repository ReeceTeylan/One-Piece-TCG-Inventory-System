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
  postedPrice: new Prisma.Decimal(100), marketListingKey: null, notes: null, images: [], ...over,
});

const CARDS = [
  card({ id: 'jp', name: 'Shanks JP', postedPrice: new Prisma.Decimal(100) }),
  card({ id: 'jpDamaged', name: 'Shanks JP whites', postedPrice: new Prisma.Decimal(100), notes: 'light whites' }),
  card({ id: 'en', name: 'Zoro EN', cardNumber: 'OP01-001', rarity: 'PL', postedPrice: new Prisma.Decimal(30000), notes: 'ENG' }),
];
const YUYUTEI = [
  { listingKey: 'op01/10150', source: 'YUYUTEI', cardNumber: 'OP01-120', rarity: 'SEC', name: 'シャンクス(刻印なし)',
    priceJpy: 320, inStock: true, stockCount: 6, url: 'u', fetchedAt: new Date() },
];
const TCG = [
  { listingKey: 'tcgp:454513:Foil', productId: 454513, subTypeName: 'Foil', cardNumber: 'OP01-001', rarity: 'L',
    name: 'Roronoa Zoro (001) (Parallel)', groupId: 3188, groupAbbr: 'OP01', priceUsd: new Prisma.Decimal('660.39'),
    url: 'u', imageUrl: null, fetchedAt: new Date() },
];

describe('MarketPricesService', () => {
  let service: MarketPricesService;
  const rawUpdate = jest.fn().mockResolvedValue({});

  beforeEach(async () => {
    rawUpdate.mockClear();
    const prisma = {
      rawCard: {
        findMany: jest.fn().mockResolvedValue(CARDS),
        findUnique: jest.fn(({ where }: any) => Promise.resolve(CARDS.find((c) => c.id === where.id) ?? null)),
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
    const res = await service.list({ page: 1, limit: 50, skip: 0 } as any);
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

  it('Match all underpriced only raises underpriced cards', async () => {
    const r = await service.matchAllUnderpriced('user1');
    expect(r.updated).toBe(2);
    expect(rawUpdate.mock.calls.map((c) => c[0]).sort()).toEqual(['en', 'jp']);
  });
});
