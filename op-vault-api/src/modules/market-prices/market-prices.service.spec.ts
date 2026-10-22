import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { RawCardsService } from '../raw-cards/raw-cards.service';
import { NotificationsService } from '../notifications/notifications.service';
import * as yuyuteiClient from './yuyutei.client';
import * as dorasutaClient from './dorasuta.client';
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
  // Not on Yuyu-tei: priced from Dorasuta. And a card whose match the owner removed.
  card({ id: 'dora', name: 'Jack', cardNumber: 'OP08-084', rarity: 'PSR', postedPrice: new Prisma.Decimal(300) }),
  card({ id: 'removed', name: 'Shanks no match', cardNumber: 'OP01-120', rarity: 'SEC', postedPrice: new Prisma.Decimal(500), marketListingKey: 'none' }),
];
const YUYUTEI = [
  { listingKey: 'op01/10150', source: 'YUYUTEI', cardNumber: 'OP01-120', rarity: 'SEC', name: 'シャンクス(刻印なし)',
    priceJpy: 320, prevPriceJpy: 300, priceChangedAt: new Date(), // moved ¥300 → ¥320 at the last sync
    inStock: true, stockCount: 6, url: 'u', fetchedAt: new Date() },
  { listingKey: 'dorasuta:541696', source: 'DORASUTA', cardNumber: 'OP08-084', rarity: 'SR/パラレル', name: 'ジャック(★SR/パラレル)(OP08-084)',
    priceJpy: 800, prevPriceJpy: null, priceChangedAt: null, inStock: true, stockCount: 11, url: 'u', fetchedAt: new Date() },
  { listingKey: 'dorasuta:541700', source: 'DORASUTA', cardNumber: 'OP01-120', rarity: 'SEC', name: 'シャンクス(OP01-120)',
    priceJpy: 150, prevPriceJpy: null, priceChangedAt: null, inStock: true, stockCount: 3, url: 'u', fetchedAt: new Date() },
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
  const emit = jest.fn().mockResolvedValue({});

  beforeEach(async () => {
    rawUpdate.mockClear();
    emit.mockClear();
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
      marketPrice: {
        findMany: jest.fn(({ where }: any = {}) => Promise.resolve(
          YUYUTEI.filter((l) => (typeof where?.cardNumber !== 'string' || l.cardNumber === where.cardNumber)
            && (where?.source === undefined || (typeof where.source === 'string' ? l.source === where.source : l.source !== where.source.not))))),
        upsert: jest.fn((a: any) => Promise.resolve(a)),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      tcgplayerPrice: { findMany: jest.fn().mockResolvedValue(TCG) },
    };
    const settings = { getAll: jest.fn().mockResolvedValue({
      jpyToPhpRate: 0.38, jpyToPhpRateDamaged: 0.3, usdToPhpRate: 58, usdToPhpRateDamaged: null, underpricedPct: 90, priceAlertPct: 5,
    }) };

    @Global()
    @Module({
      providers: [
        { provide: PrismaService, useValue: prisma },
        { provide: SettingsService, useValue: settings },
        { provide: ActivityLogsService, useValue: { log: jest.fn() } },
        { provide: NotificationsService, useValue: { emit } },
      ],
      exports: [PrismaService, SettingsService, ActivityLogsService, NotificationsService],
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
    // Jack isn't on Yuyu-tei: Dorasuta ¥800 × 0.38 = ₱304, so posted ₱300 isn't flagged at 90%.
    expect(by.dora).toMatchObject({ marketPhp: 304, underpriced: false, matchPrice: null });
    expect(by.dora.listing).toMatchObject({ source: 'DORASUTA', listingKey: 'dorasuta:541696', price: 800 });
    // Owner removed the match: no market price even though Yuyu-tei lists OP01-120 SEC.
    expect(by.removed).toMatchObject({ unlinked: true, listing: null, marketPhp: null });
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
    expect(byNumber.data.map((r) => r.id).sort()).toEqual(['jp', 'jpDamaged', 'removed']);
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
    expect(hi.data.map((r) => r.id)).toEqual(['en', 'dora', 'jp', 'jpDamaged', 'removed']); // no price goes last
    const lo = await service.list({ page: 1, limit: 50, skip: 0, view: 'all', sort: 'price_asc' } as any);
    expect(lo.data.map((r) => r.id)).toEqual(['jpDamaged', 'jp', 'dora', 'en', 'removed']);
    // margins vs ₱50 cost: en (38303−50)/38303 ≈ 99.9%, jp (122−50)/122 = 59%, damaged (96−50)/96 = 47.9%
    const margin = await service.list({ page: 1, limit: 50, skip: 0, view: 'all', sort: 'margin_desc' } as any);
    expect(margin.data.map((r) => [r.id, r.marginPct])).toEqual([['en', 99.9], ['dora', 83.6], ['jp', 59], ['jpDamaged', 47.9], ['removed', null]]);
  });

  it('raw inventory value = market × qty, 80% of posted when no market price', async () => {
    const v = await service.rawInventoryValue();
    // The removed-match card counts at 80% of its ₱500 posted price.
    expect(v).toEqual({ total: 122 + 96 + 38303 + 304 + 400, market: 122 + 96 + 38303 + 304, fallback: 400, matchedCards: 4, fallbackCards: 1 });
  });

  it('movers: biggest change first, one row per listing', async () => {
    const m = await service.movers(5);
    // The clean and the damaged Shanks share one Yuyu-tei listing, so it counts once.
    expect(m.changed).toBe(1);
    expect(m.data).toEqual([expect.objectContaining({ id: 'jp', changePhp: 8, changePct: 7 })]); // ₱114 → ₱122
  });

  it('forCards returns market prices only for the ids asked', async () => {
    const r = await service.forCards(['en', 'missing']);
    expect(Object.keys(r)).toEqual(['en']);
    expect(r.en).toMatchObject({ marketPhp: 38303, matchPrice: 38300, source: 'TCGPLAYER', language: 'EN' });
  });

  it('suggest uses the stored listing when it is fresh, with the damaged rate from notes', async () => {
    const spy = jest.spyOn(yuyuteiClient, 'fetchYuyuteiSearch');
    const clean = await service.suggest('op01-120', 'SEC');
    expect(clean).toMatchObject({ found: true, source: 'YUYUTEI', price: 320, rate: 0.38, marketPhp: 122, suggested: 120 });
    const damaged = await service.suggest('OP01-120', 'SEC', 'small dent');
    expect(damaged).toMatchObject({ damage: 'dent', rate: 0.3, marketPhp: 96, suggested: 100 });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('suggest fetches Yuyu-tei live once for a number it has never priced', async () => {
    const spy = jest.spyOn(yuyuteiClient, 'fetchYuyuteiSearch').mockResolvedValue('<html></html>');
    const dSpy = jest.spyOn(dorasutaClient, 'fetchDorasutaSearch').mockResolvedValue('<html></html>');
    const a = await service.suggest('OP05-119', 'SEC');
    const b = await service.suggest('OP05-119', 'SEC');
    expect(a).toMatchObject({ found: false, reason: 'Neither Yuyu-tei nor Dorasuta lists OP05-119' });
    expect(b.found).toBe(false);
    expect(spy).toHaveBeenCalledTimes(1); // cooldown: the second lookup doesn't hit Yuyu-tei again
    expect(dSpy).toHaveBeenCalledTimes(1); // nor Dorasuta
    spy.mockRestore(); dSpy.mockRestore();
  });

  it('suggest falls back to Dorasuta when Yuyu-tei has no listing', async () => {
    const y = jest.spyOn(yuyuteiClient, 'fetchYuyuteiSearch').mockResolvedValue('<html></html>');
    const d = jest.spyOn(dorasutaClient, 'fetchDorasutaSearch');
    const r = await service.suggest('OP08-084', 'PSR');
    expect(r).toMatchObject({ found: true, source: 'DORASUTA', price: 800, marketPhp: 304, suggested: 300 });
    expect(d).not.toHaveBeenCalled(); // the saved Dorasuta listing is fresh
    y.mockRestore(); d.mockRestore();
  });

  it('sync searches Dorasuta only for cards Yuyu-tei has no listing for (or pinned to Dorasuta)', async () => {
    const { readFileSync } = jest.requireActual('fs');
    const html = readFileSync(require('path').join(__dirname, '__fixtures__', 'dorasuta-op08-084.html'), 'utf8');
    const d = jest.spyOn(dorasutaClient, 'fetchDorasutaSearch').mockResolvedValue(html);
    jest.spyOn(global, 'setTimeout').mockImplementation(((fn: () => void) => { fn(); return 0 as any; }) as any);
    await (service as any).syncDorasuta([
      { cardNumber: 'OP01-120', rarity: 'SEC', marketListingKey: null },  // on Yuyu-tei: skipped
      { cardNumber: 'OP08-084', rarity: 'PSR', marketListingKey: null },  // not on Yuyu-tei: searched
    ]);
    (global.setTimeout as any).mockRestore?.();
    expect(d.mock.calls.map((c) => c[0])).toEqual(['OP08-084']);
    const saved = prisma.marketPrice.upsert.mock.calls.map((c: any) => [c[0].where.listingKey, c[0].create.source]);
    expect(saved).toContainEqual(['dorasuta:541696', 'DORASUTA']);
    expect(prisma.marketPrice.deleteMany).toHaveBeenCalledWith({
      where: { cardNumber: 'OP08-084', source: 'DORASUTA', listingKey: { notIn: expect.arrayContaining(['dorasuta:541696']) } },
    });
    d.mockRestore();
  });

  it('link accepts "none" to remove a match', async () => {
    prisma.rawCard.findUnique = jest.fn().mockResolvedValue({ cardNumber: 'OP01-120' });
    await expect(service.link('jp', 'none')).resolves.toEqual({ id: 'jp', marketListingKey: 'none' });
    expect(prisma.rawCard.update).toHaveBeenCalledWith({ where: { id: 'jp' }, data: { marketListingKey: 'none' } });
  });

  it('a pasted buy.dorasuta.jp link is refused with a clear message', async () => {
    await expect(service.linkByUrl('jp', 'https://buy.dorasuta.jp/onepiece-cardgame/product?pid=559715'))
      .rejects.toThrow(/buy-list/);
  });

  it('suggest explains rarities that cannot be matched automatically', async () => {
    const r = await service.suggest('OP01-120', 'Don');
    expect(r.found).toBe(false);
    expect(r.reason).toMatch(/paste its Yuyu-tei link/);
  });

  it('after a sync, one notification lists cards that moved more than the alert %', async () => {
    await (service as any).notifyBigMoves(new Date(Date.now() - 60_000));
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit.mock.calls[0][0]).toMatchObject({
      type: 'SYSTEM', title: '1 card moved more than 5%', body: 'Shanks JP (OP01-120) ▲ ₱8 (+7%)',
    });
    emit.mockClear();
    await (service as any).notifyBigMoves(new Date(Date.now() + 60_000)); // nothing changed after this time
    expect(emit).not.toHaveBeenCalled();
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

