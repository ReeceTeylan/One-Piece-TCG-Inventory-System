import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MarketPrice, Prisma, TcgplayerPrice } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RawCardsService } from '../raw-cards/raw-cards.service';
import { SlabPricesService } from './slab-prices.service';
import { fetchYuyuteiCardPage, fetchYuyuteiSearch } from './yuyutei.client';
import { parseYuyuteiCardPage, parseYuyuteiCardUrl, parseYuyuteiSearch, YuyuteiListing } from './yuyutei.parser';
import { fetchGroups, fetchPrices, fetchProducts, TcgcsvGroup } from './tcgcsv.client';
import { fetchCardrushSearch } from './cardrush.client';
import { CARDRUSH_PREFIX, parseCardrushProductUrl, parseCardrushSearch } from './cardrush.parser';
import { groupHasWanted, joinGroup, TcgRow } from './tcgcsv.parser';
import {
  comparePrice, damageReason, isEnglish, pickAutoListing, pickCardrushListing, pickTcgListing, roundPrice, toYuyuteiRarity,
} from './market-match';
import { QueryMarketPricesDto } from './dto/query-market-prices.dto';

const DELAY_MS = 1500;          // gap between Yuyu-tei requests — be a polite visitor
const TCGCSV_DELAY_MS = 300;    // TCGCSV asks for a short pause between requests
const LAST_RUN_KEY = 'marketSyncLastRun';
const LAST_LINK_KEY = 'marketLinkLastRun';
// If Cardrush ever refuses the server (HTTP 403), stop asking for a while
// instead of retrying every card.
const BLOCK_BACKOFF_MS = 6 * 60 * 60 * 1000;
// Listings found by card-number search vs. pasted by the owner as a direct link.
// Linked ones are refreshed from their own page and never pruned by a search.
const SOURCE_SEARCH = 'YUYUTEI';
const SOURCE_LINK = 'YUYUTEI_LINK';
const YUYUTEI_SOURCES = [SOURCE_SEARCH, SOURCE_LINK];
// Cardrush: backup for Japanese cards Yuyu-tei doesn't list (searched by card number).
const SOURCE_CARDRUSH = 'CARDRUSH';
// Dorasuta was removed (it blocks servers). Cards still linked to it count as not linked.
const isRetiredKey = (k: string | null | undefined) => !!k && k.startsWith('dorasuta:');
const TCG_PREFIX = 'tcgp:';
// marketListingKey value meaning "this card has no market price" (match removed by the owner).
export const NO_MATCH = 'none';
// "Changed today" window: a little over a day so the 3 AM sync's changes stay
// visible until the next one lands.
const CHANGE_WINDOW_MS = 26 * 60 * 60 * 1000;
// Suggested price: a card number is fetched live at most once per 10 minutes.
const LIVE_COOLDOWN_MS = 10 * 60 * 1000;
const DEFAULT_ALERT_PCT = 20;

export interface SyncState {
  running: boolean;
  trigger: 'nightly' | 'manual' | 'link' | null;
  phase: 'yuyutei' | 'cardrush' | 'tcgplayer' | null;
  linked: number;               // Link new stock: cards linked this run
  unmatched: number;            // Link new stock: cards with no listing found
  total: number;
  done: number;
  failed: number;
  empty: number;                // card numbers Yuyu-tei returned no listings for
  startedAt: string | null;
  finishedAt: string | null;
  lastError: string | null;
}

/** One price source, normalised for the page (yen for Yuyu-tei, dollars for TCGplayer). */
export interface RowListing {
  source: 'YUYUTEI' | 'CARDRUSH' | 'TCGPLAYER';
  listingKey: string;
  name: string;
  rarity: string | null;
  price: number;
  currency: 'JPY' | 'USD';
  inStock: boolean | null;      // TCGCSV doesn't report stock
  stockCount: number | null;
  url: string;
  fetchedAt: Date;
  manual: boolean;              // always true now: every price comes from a saved link
  viaLink: boolean;
  prevPrice: number | null;      // foreign price before the last change
  priceChangedAt: Date | null;
}

export type LinkState = 'linked' | 'new' | 'none' | 'missing';

interface Rates { jpy: number | null; jpyDamaged: number | null; usd: number | null; usdDamaged: number | null; pct: number }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const norm = (n: string) => n.trim().toUpperCase();
const positive = (v: unknown) => (Number(v) > 0 ? Number(v) : null);

const CARD_SELECT = {
  id: true, name: true, cardNumber: true, rarity: true, setName: true, quantity: true,
  postedPrice: true, buyCost: true, createdAt: true, marketListingKey: true, notes: true,
  images: { take: 1, select: { url: true } },
} satisfies Prisma.RawCardSelect;
type CardForPricing = Prisma.RawCardGetPayload<{ select: typeof CARD_SELECT }>;
type PricedRow = Awaited<ReturnType<MarketPricesService['priceCards']>>[number];

@Injectable()
export class MarketPricesService {
  private readonly logger = new Logger(MarketPricesService.name);
  private state: SyncState = {
    running: false, trigger: null, phase: null, total: 0, done: 0, failed: 0, empty: 0, linked: 0, unmatched: 0,
    startedAt: null, finishedAt: null, lastError: null,
  };
  private cardrushBlockedUntil = 0;

  /** Last fully priced in-stock list, reused while nothing it depends on has changed. */
  private priced: { key: string; rows: PricedRow[]; rates: Rates; all: Record<string, any> } | null = null;
  private pricing: Promise<NonNullable<MarketPricesService['priced']>> | null = null;

  /** Suggested-price live lookups: last attempt per card number, and ones in progress. */
  private liveTried = new Map<string, number>();
  private liveInFlight = new Map<string, Promise<void>>();
  private tcgGroupsCache: { at: number; groups: TcgcsvGroup[] } | null = null;

  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
    private audit: ActivityLogsService,
    private rawCards: RawCardsService,
    private notifications: NotificationsService,
    private slabPrices: SlabPricesService,
  ) {}

  // ----------------------------- sync & link -----------------------------
  //
  // Every card's market listing is saved on the card (marketListingKey):
  //   null       → not linked yet (new stock): "Link new stock" finds its listing
  //   "none"     → the owner removed the match: never linked again automatically
  //   a key      → linked (automatically or by the owner): Sync refreshes its price
  // Sync never changes links; Link never touches cards that already have one.

  /** 3:00 AM Philippine time: refresh prices of linked cards. Needs the Render service awake. */
  @Cron('0 3 * * *', { name: 'yuyutei-sync', timeZone: 'Asia/Manila' })
  async nightly() {
    await this.runSync('nightly');
  }

  status(): SyncState {
    return { ...this.state };
  }

  /** Sync now: refresh linked prices in the background; returns immediately. */
  startManual(): SyncState {
    if (!this.state.running) {
      this.runSync('manual').catch((e) => this.logger.error(`Sync crashed: ${e?.message ?? e}`));
    }
    return this.status();
  }

  /** Link new stock: find listings for in-stock cards that were never linked. */
  startLink(): SyncState {
    if (!this.state.running) {
      this.runJob('link', LAST_LINK_KEY, () => this.linkNewStock())
        .catch((e) => this.logger.error(`Link crashed: ${e?.message ?? e}`));
    }
    return this.status();
  }

  private runSync(trigger: 'nightly' | 'manual') {
    return this.runJob(trigger, LAST_RUN_KEY, () => this.refreshLinked());
  }

  /** Shared lock, progress and "last run" record for Sync and Link. */
  private async runJob(trigger: SyncState['trigger'], lastKey: string, work: () => Promise<void>) {
    if (this.state.running) return;
    // Claim the lock before the first await so two triggers can't both start.
    this.state = { ...this.state, running: true, trigger, phase: 'yuyutei', total: 0, done: 0, failed: 0, empty: 0,
      linked: 0, unmatched: 0, startedAt: new Date().toISOString(), finishedAt: null, lastError: null };
    try {
      await work();
    } catch (e: any) {
      this.state.lastError = e?.message ?? String(e);
      this.logger.error(`Market ${trigger} aborted: ${this.state.lastError}`);
    } finally {
      this.state.running = false;
      this.state.phase = null;
      this.state.finishedAt = new Date().toISOString();
      const summary = { ...this.state } as unknown as Prisma.InputJsonValue;
      await this.prisma.setting.upsert({
        where: { key: lastKey }, update: { value: summary }, create: { key: lastKey, value: summary },
      }).catch(() => undefined);
      this.logger.log(`Market ${trigger} finished: ${this.state.done}/${this.state.total}, ${this.state.failed} failed`);
    }
  }

  /** Sync: fetch fresh prices for the listings in-stock cards are linked to. Links don't change. */
  private async refreshLinked() {
    const cards = await this.prisma.rawCard.findMany({
      where: { quantity: { gt: 0 }, marketListingKey: { not: null } },
      select: { cardNumber: true, marketListingKey: true },
    });
    const linkedCards = cards.filter((c) => c.marketListingKey !== NO_MATCH && !isRetiredKey(c.marketListingKey));
    const shopKeys = linkedCards.map((c) => c.marketListingKey!).filter((k) => !k.startsWith(TCG_PREFIX));
    const stored = new Map((await this.prisma.marketPrice.findMany({
      where: { listingKey: { in: shopKeys } }, select: { listingKey: true, source: true, cardNumber: true },
    })).map((m) => [m.listingKey, m]));

    const yuyuteiNums = new Set<string>();
    const pages = new Set<string>();
    const cardrushNums = new Set<string>();
    const tcgNums = new Set<string>();
    for (const c of linkedCards) {
      const key = c.marketListingKey!;
      const row = stored.get(key);
      const num = row?.cardNumber ?? norm(c.cardNumber);
      if (key.startsWith(TCG_PREFIX)) tcgNums.add(norm(c.cardNumber));
      else if (key.startsWith(CARDRUSH_PREFIX)) cardrushNums.add(num);
      else if (row?.source === SOURCE_LINK) pages.add(key);
      else yuyuteiNums.add(num); // a listing that vanished is looked for again under its number
    }
    // Graded slabs are priced from Cardrush copies of their card number.
    for (const n of await this.slabPrices.linkedSlabNumbers()) cardrushNums.add(n);
    this.state.total = yuyuteiNums.size + pages.size;
    this.logger.log(`Price sync: ${yuyuteiNums.size} Yuyu-tei searches, ${pages.size} linked pages, ${cardrushNums.size} Cardrush searches, ${tcgNums.size} English card numbers`);

    await this.searchYuyutei([...yuyuteiNums].sort(), true);
    for (const key of [...pages].sort()) {
      await sleep(DELAY_MS);
      try {
        const [ver, cid] = key.split('/');
        const listing = parseYuyuteiCardPage(await this.withRetry(() => fetchYuyuteiCardPage(ver, cid)));
        if (!listing || listing.listingKey !== key) throw new Error('page layout not recognised');
        await this.saveLinked(listing);
      } catch (e: any) {
        this.recordFailure(key, e);
      }
      this.state.done++;
    }
    if (cardrushNums.size) await this.searchCardrush([...cardrushNums].sort(), true);
    if (tcgNums.size) await this.syncTcgplayer(tcgNums);
    await this.notifyBigMoves(new Date(this.state.startedAt!));
  }

  /** Link new stock: every in-stock card with no link yet (cards whose match was removed are left alone). */
  private async linkNewStock() {
    const cards = await this.prisma.rawCard.findMany({
      where: { quantity: { gt: 0 }, OR: [{ marketListingKey: null }, { marketListingKey: { startsWith: 'dorasuta:' } }] },
      select: { id: true, cardNumber: true, rarity: true, notes: true },
    });
    this.logger.log(`Link new stock: ${cards.length} unlinked cards`);
    const keys = await this.autoLink(cards, true);

    // Graded slabs: search Cardrush for their numbers (unless fresh), then link the unambiguous ones.
    const slabs = await this.slabPrices.unlinkedSlabs();
    const slabNums = [...new Set(slabs.map((x) => x.cardNumber?.trim().toUpperCase()).filter((n): n is string => !!n))];
    if (slabNums.length) {
      const have = groupBy(await this.prisma.marketPrice.findMany({
        where: { source: SOURCE_CARDRUSH, cardNumber: { in: slabNums } }, select: { cardNumber: true, fetchedAt: true },
      }), (r) => r.cardNumber);
      const stale = slabNums.filter((n) => !isFresh(have.get(n) ?? [])).sort();
      if (stale.length) await this.searchCardrush(stale, true);
    }
    const slabResult = slabs.length ? await this.slabPrices.autoLink(slabs) : { linked: 0, unmatched: 0 };
    this.state.linked = keys.size + slabResult.linked;
    this.state.unmatched = cards.length - keys.size + slabResult.unmatched;
  }

  /**
   * Find and save a listing for each card: Yuyu-tei first, Cardrush for Japanese
   * cards Yuyu-tei doesn't list, TCGplayer for English. Listings fetched in the
   * last day are reused. Returns card id → saved listing key.
   */
  private async autoLink(cards: { id: string; cardNumber: string; rarity: string; notes: string | null }[], track: boolean) {
    const found = new Map<string, string>();
    const jp = cards.filter((c) => !isEnglish(c.notes));
    const en = cards.filter((c) => isEnglish(c.notes));

    if (jp.length) {
      const nums = [...new Set(jp.map((c) => norm(c.cardNumber)).filter(Boolean))];
      const yWhere = { cardNumber: { in: nums }, source: { in: YUYUTEI_SOURCES } };
      const stale = (rows: { cardNumber: string; fetchedAt: Date }[], list: string[]) => {
        const by = groupBy(rows, (r) => r.cardNumber);
        return list.filter((n) => !isFresh(by.get(n) ?? [])).sort();
      };
      const yStale = stale(await this.prisma.marketPrice.findMany({ where: yWhere, select: { cardNumber: true, fetchedAt: true } }), nums);
      if (track) this.state.total += yStale.length;
      await this.searchYuyutei(yStale, track);
      const yByNum = groupBy(await this.prisma.marketPrice.findMany({ where: yWhere }), (r) => r.cardNumber);
      const missing: typeof jp = [];
      for (const c of jp) {
        const y = pickAutoListing(c, yByNum.get(norm(c.cardNumber)) ?? []);
        if (y) found.set(c.id, y.listingKey); else missing.push(c);
      }

      if (missing.length) {
        const dNums = [...new Set(missing.map((c) => norm(c.cardNumber)))];
        const dWhere = { cardNumber: { in: dNums }, source: SOURCE_CARDRUSH };
        const dStale = stale(await this.prisma.marketPrice.findMany({ where: dWhere, select: { cardNumber: true, fetchedAt: true } }), dNums);
        if (dStale.length) await this.searchCardrush(dStale, track);
        const dByNum = groupBy(await this.prisma.marketPrice.findMany({ where: dWhere }), (r) => r.cardNumber);
        for (const c of missing) {
          const d = pickCardrushListing(c, dByNum.get(norm(c.cardNumber)) ?? []);
          if (d) found.set(c.id, d.listingKey);
        }
      }
    }

    if (en.length) {
      const nums = [...new Set(en.map((c) => norm(c.cardNumber)).filter(Boolean))];
      const have = groupBy(await this.prisma.tcgplayerPrice.findMany({
        where: { cardNumber: { in: nums } }, select: { cardNumber: true, fetchedAt: true },
      }), (r) => r.cardNumber);
      const tStale = nums.filter((n) => !isFresh(have.get(n) ?? []));
      if (tStale.length) {
        if (track) await this.syncTcgplayer(new Set(tStale));
        else for (const n of tStale) await this.liveTcgplayer(n).catch((e) => this.logger.warn(`TCGplayer ${n}: ${e?.message ?? e}`));
      }
      const tByNum = groupBy(await this.prisma.tcgplayerPrice.findMany({ where: { cardNumber: { in: nums } } }), (t) => t.cardNumber);
      for (const c of en) {
        const t = pickTcgListing(c, (tByNum.get(norm(c.cardNumber)) ?? []).map((r) => ({ ...r, priceUsd: Number(r.priceUsd) })));
        if (t) found.set(c.id, t.listingKey);
      }
    }

    if (found.size) {
      await this.prisma.$transaction([...found].map(([id, key]) =>
        this.prisma.rawCard.update({ where: { id }, data: { marketListingKey: key } })));
    }
    return found;
  }

  /** Search Yuyu-tei for each number and save what it lists. */
  private async searchYuyutei(nums: string[], track: boolean) {
    if (track) this.state.phase = 'yuyutei';
    for (const [i, num] of nums.entries()) {
      if (i > 0) await sleep(DELAY_MS);
      try {
        const listings = parseYuyuteiSearch(await this.withRetry(() => fetchYuyuteiSearch(num))).filter((l) => l.cardNumber === num);
        if (listings.length) await this.saveListings(num, listings);
        else if (track) this.state.empty++;
      } catch (e: any) {
        if (track) this.recordFailure(num, e); else this.logger.warn(`Yuyu-tei ${num}: ${e?.message ?? e}`);
      }
      if (track) this.state.done++;
    }
  }

  /** Search Cardrush for each number and save what it lists. Stops early if Cardrush refuses the server. */
  private async searchCardrush(nums: string[], track: boolean) {
    if (track) { this.state.phase = 'cardrush'; this.state.total += nums.length; }
    for (const [i, num] of nums.entries()) {
      if (i > 0) await sleep(DELAY_MS);
      try {
        const listings = await this.cardrushSearch(num);
        if (listings.length) await this.saveListings(num, listings, SOURCE_CARDRUSH);
        else if (track) this.state.empty++;
      } catch (e: any) {
        if (this.cardrushBlocked()) {
          // Every remaining number would be refused too: count them once and stop.
          if (track) { this.recordFailure(`Cardrush (${nums.length - i} numbers)`, e); this.state.done += nums.length - i; }
          else this.logger.warn(`Cardrush: ${e?.message ?? e}`);
          return;
        }
        if (track) this.recordFailure(`Cardrush ${num}`, e); else this.logger.warn(`Cardrush ${num}: ${e?.message ?? e}`);
      }
      if (track) this.state.done++;
    }
  }

  private cardrushBlocked() {
    return Date.now() < this.cardrushBlockedUntil;
  }

  /** One Cardrush search, refusing early if Cardrush has been blocking the server. */
  private async cardrushSearch(num: string) {
    const blocked = 'Cardrush is refusing requests from this server (403). Not asking again for a few hours.';
    if (this.cardrushBlocked()) throw new Error(blocked);
    try {
      return parseCardrushSearch(await this.withRetry(() => fetchCardrushSearch(num))).filter((l) => l.cardNumber === num);
    } catch (e: any) {
      if (/\b403\b/.test(e?.message ?? '')) {
        this.cardrushBlockedUntil = Date.now() + BLOCK_BACKOFF_MS;
        throw new Error(blocked);
      }
      throw e;
    }
  }

  /**
   * English cards: walk TCGCSV's One Piece sets once, keep products whose
   * card number we stock in English, and fetch prices only for sets that have them.
   */
  private async syncTcgplayer(wanted: Set<string>) {
    this.state.phase = 'tcgplayer';
    const groups = await this.withRetry(() => fetchGroups());
    this.state.total += groups.length;
    const rows: TcgRow[] = [];
    let groupFailures = 0;

    for (const g of groups) {
      await sleep(TCGCSV_DELAY_MS);
      try {
        const products = await this.withRetry(() => fetchProducts(g.groupId));
        if (groupHasWanted(products, wanted)) {
          await sleep(TCGCSV_DELAY_MS);
          const prices = await this.withRetry(() => fetchPrices(g.groupId));
          rows.push(...joinGroup(g, products, prices, wanted));
        }
      } catch (e: any) {
        groupFailures++;
        this.recordFailure(`TCGplayer set ${g.abbreviation ?? g.groupId}`, e);
      }
      this.state.done++;
    }

    await this.prisma.$transaction([
      ...(await this.tcgUpserts(rows)),
      // Only prune when every set was read, so a TCGCSV hiccup never wipes prices.
      ...(groupFailures === 0 ? [this.prisma.tcgplayerPrice.deleteMany({
        where: { cardNumber: { in: [...wanted] }, listingKey: { notIn: rows.map((r) => r.listingKey) } },
      })] : []),
    ]);
  }

  /** Upserts for TCGplayer rows, recording the old price when it changed. */
  private async tcgUpserts(rows: TcgRow[]) {
    const fetchedAt = new Date();
    const old = new Map((await this.prisma.tcgplayerPrice.findMany({
      where: { listingKey: { in: rows.map((r) => r.listingKey) } }, select: { listingKey: true, priceUsd: true },
    })).map((o) => [o.listingKey, Number(o.priceUsd)]));
    return rows.map((r) => {
      const data = { ...r, priceUsd: new Prisma.Decimal(r.priceUsd.toFixed(2)), fetchedAt };
      const change = changeFields(old.get(r.listingKey), r.priceUsd, 'prevPriceUsd', fetchedAt);
      return this.prisma.tcgplayerPrice.upsert({ where: { listingKey: r.listingKey }, update: { ...data, ...change }, create: data });
    });
  }

  private async withRetry<T>(fetchPage: () => Promise<T>) {
    try {
      return await fetchPage();
    } catch {
      await sleep(DELAY_MS * 2);
      return fetchPage();
    }
  }

  private recordFailure(what: string, e: any) {
    this.state.failed++;
    this.state.lastError = `${what}: ${e?.message ?? e}`;
    this.logger.warn(`Price sync ${what} failed: ${e?.message ?? e}`);
  }

  private async saveLinked(l: YuyuteiListing) {
    const fetchedAt = new Date();
    const old = await this.prisma.marketPrice.findUnique({ where: { listingKey: l.listingKey }, select: { priceJpy: true } });
    return this.prisma.marketPrice.upsert({
      where: { listingKey: l.listingKey },
      update: { ...l, source: SOURCE_LINK, fetchedAt, ...changeFields(old?.priceJpy, l.priceJpy, 'prevPriceJpy', fetchedAt) },
      create: { ...l, source: SOURCE_LINK, fetchedAt },
    });
  }

  /** Upsert this card number's listings and drop ones the shop no longer shows. */
  private async saveListings(num: string, listings: YuyuteiListing[], source = SOURCE_SEARCH) {
    const fetchedAt = new Date();
    const old = new Map((await this.prisma.marketPrice.findMany({
      where: { listingKey: { in: listings.map((l) => l.listingKey) } }, select: { listingKey: true, priceJpy: true },
    })).map((o) => [o.listingKey, o.priceJpy]));
    await this.prisma.$transaction([
      ...listings.map((l) => this.prisma.marketPrice.upsert({
        where: { listingKey: l.listingKey },
        update: { ...l, source, fetchedAt, ...changeFields(old.get(l.listingKey), l.priceJpy, 'prevPriceJpy', fetchedAt) },
        create: { ...l, source, fetchedAt },
      })),
      this.prisma.marketPrice.deleteMany({
        where: { cardNumber: num, source, listingKey: { notIn: listings.map((l) => l.listingKey) } },
      }),
    ]);
  }

  // ----------------------------- pricing -----------------------------

  private async rates(): Promise<{ rates: Rates; all: Record<string, any> }> {
    const all = await this.settings.getAll();
    return {
      all,
      rates: {
        jpy: positive(all.jpyToPhpRate),
        jpyDamaged: positive(all.jpyToPhpRateDamaged),
        usd: positive(all.usdToPhpRate),
        usdDamaged: positive(all.usdToPhpRateDamaged),
        pct: positive(all.underpricedPct) ?? 90,
      },
    };
  }

  /** Price every given card against its market source. Shared by the page and the Match buttons. */
  private async priceCards(cards: CardForPricing[], rates: Rates) {
    const jpCards = cards.filter((c) => !isEnglish(c.notes));
    const enCards = cards.filter((c) => isEnglish(c.notes));

    const jpNumbers = [...new Set(jpCards.map((c) => norm(c.cardNumber)))];
    const jpManual = jpCards.map((c) => c.marketListingKey).filter((k): k is string => !!k && k !== NO_MATCH && !k.startsWith(TCG_PREFIX));
    const enNumbers = [...new Set(enCards.map((c) => norm(c.cardNumber)))];
    // Both price tables are read at the same time (one round trip instead of two).
    const [yuyutei, tcg] = await Promise.all([
      jpCards.length
        ? this.prisma.marketPrice.findMany({
            where: { OR: [{ cardNumber: { in: jpNumbers } }, { listingKey: { in: jpManual } }] },
          })
        : Promise.resolve([] as MarketPrice[]),
      enCards.length
        ? this.prisma.tcgplayerPrice.findMany({ where: { cardNumber: { in: enNumbers } } })
        : Promise.resolve([] as TcgplayerPrice[]),
    ]);

    const yByKey = new Map(yuyutei.map((l) => [l.listingKey, l]));
    const yByNum = groupBy(yuyutei, (l) => l.cardNumber);
    const tByKey = new Map(tcg.map((t) => [t.listingKey, t]));
    const tByNum = groupBy(tcg, (t) => t.cardNumber);
    const tcgLike = (t: TcgplayerPrice) => ({ ...t, priceUsd: Number(t.priceUsd) });

    return cards.map((c) => {
      const english = isEnglish(c.notes);
      const damage = damageReason(c.notes);
      const posted = Number(c.postedPrice);
      let listing: RowListing | null = null;
      let candidateCount: number;
      // Prices come only from the card's saved link (see "sync & link" above).
      const key = isRetiredKey(c.marketListingKey) ? null : c.marketListingKey;

      if (english) {
        candidateCount = (tByNum.get(norm(c.cardNumber)) ?? []).length;
        const raw = key?.startsWith(TCG_PREFIX) ? tByKey.get(key) : undefined;
        const t = raw ? tcgLike(raw) : null;
        if (t) {
          listing = {
            source: 'TCGPLAYER', listingKey: t.listingKey, name: `${t.name} · ${t.subTypeName}`, rarity: t.rarity,
            price: t.priceUsd, currency: 'USD', inStock: null, stockCount: null,
            url: t.url, fetchedAt: t.fetchedAt, manual: true, viaLink: false,
            prevPrice: t.prevPriceUsd != null ? Number(t.prevPriceUsd) : null, priceChangedAt: t.priceChangedAt,
          };
        }
      } else {
        candidateCount = (yByNum.get(norm(c.cardNumber)) ?? []).length;
        const y = key && key !== NO_MATCH && !key.startsWith(TCG_PREFIX) ? yByKey.get(key) : undefined;
        if (y) {
          listing = {
            source: y.source === SOURCE_CARDRUSH ? 'CARDRUSH' : 'YUYUTEI', listingKey: y.listingKey, name: y.name, rarity: y.rarity,
            price: y.priceJpy, currency: 'JPY', inStock: y.inStock, stockCount: y.stockCount,
            url: y.url, fetchedAt: y.fetchedAt, manual: true, viaLink: y.source === SOURCE_LINK,
            prevPrice: y.prevPriceJpy, priceChangedAt: y.priceChangedAt,
          };
        }
      }

      // Damaged cards use the lower rate when it's set; otherwise the normal one.
      const normalRate = english ? rates.usd : rates.jpy;
      const damagedRate = english ? rates.usdDamaged : rates.jpyDamaged;
      const rate = damage && damagedRate ? damagedRate : normalRate;
      const cmp = listing ? comparePrice(posted, listing.price, rate, rates.pct)
        : { marketPhp: null, diffPct: null, underpriced: false };
      const matchPrice = cmp.marketPhp !== null ? roundPrice(cmp.marketPhp) : null;

      // Peso change from the last price move, valued at today's rate so it
      // reflects the market moving, not the exchange rate.
      const recent = !!listing?.priceChangedAt && Date.now() - listing.priceChangedAt.getTime() <= CHANGE_WINDOW_MS;
      const changePhp = recent && listing!.prevPrice != null && rate && cmp.marketPhp !== null
        ? cmp.marketPhp - Math.round(listing!.prevPrice * rate) : null;
      const buyCost = Number(c.buyCost);
      const marginPct = cmp.marketPhp ? Math.round(((cmp.marketPhp - buyCost) / cmp.marketPhp) * 1000) / 10 : null;

      return {
        id: c.id, name: c.name, cardNumber: c.cardNumber, rarity: c.rarity, setName: c.setName,
        quantity: c.quantity, postedPrice: posted, buyCost, createdAt: c.createdAt,
        imageUrl: c.images[0]?.url ?? null, notes: c.notes,
        condition: damage ? 'issues' as const : 'clean' as const,
        changePhp: changePhp || null,
        marginPct,
        language: english ? 'EN' as const : 'JP' as const,
        // new = never linked (Link new stock picks it up), none = match removed by the owner,
        // missing = linked listing no longer on the shop (or the card switched language).
        linkState: (key === NO_MATCH ? 'none' : !key ? 'new' : listing ? 'linked' : 'missing') as LinkState,
        damage,
        rateUsed: rate,
        damagedRateMissing: !!damage && !damagedRate,
        listing,
        candidateCount,
        ...cmp,
        matchPrice: matchPrice !== null && matchPrice !== posted ? matchPrice : null,
      };
    });
  }

  /**
   * Every in-stock raw card, priced. Cached in memory and reused until any
   * input changes: one tiny "fingerprint" query per request checks the newest
   * edit time and row count of cards, photos, settings and both price tables.
   * A sale, edit, new photo, settings save or sync all change the fingerprint,
   * so the cache can never serve stale prices.
   */
  private async loadPriced() {
    const key = await this.fingerprint();
    if (this.priced?.key === key) return this.priced;
    if (!this.pricing) {
      this.pricing = (async () => {
        const [{ rates, all }, cards] = await Promise.all([
          this.rates(),
          this.prisma.rawCard.findMany({ where: { quantity: { gt: 0 } }, select: CARD_SELECT }),
        ]);
        const rows = await this.priceCards(cards, rates);
        this.priced = { key, rows, rates, all };
        return this.priced;
      })().finally(() => { this.pricing = null; });
    }
    return this.pricing;
  }

  private async fingerprint(): Promise<string> {
    const [f] = await this.prisma.$queryRaw<Record<string, unknown>[]>(Prisma.sql`SELECT
      (SELECT max("updatedAt") FROM raw_cards)        AS rc_at,
      (SELECT count(*)         FROM raw_cards)        AS rc_n,
      (SELECT max("createdAt") FROM card_images)      AS img_at,
      (SELECT count(*)         FROM card_images)      AS img_n,
      (SELECT max("updatedAt") FROM settings)         AS set_at,
      (SELECT max("fetchedAt") FROM market_prices)    AS mp_at,
      (SELECT count(*)         FROM market_prices)    AS mp_n,
      (SELECT max("fetchedAt") FROM tcgplayer_prices) AS tp_at,
      (SELECT count(*)         FROM tcgplayer_prices) AS tp_n`);
    // The "changed in the last day" flag depends on the clock, so refresh hourly too.
    const hour = Math.floor(Date.now() / 3_600_000);
    return JSON.stringify({ ...f, hour }, (_k, v) => (typeof v === 'bigint' ? v.toString() : v));
  }

  async list(q: QueryMarketPricesDto) {
    const { rows: allRows, rates, all } = await this.loadPriced();
    let rows = allRows;
    const term = q.search?.trim().toLowerCase();
    if (term) {
      // "op01 120", "OP01-120" and "op01120" all find OP01-120.
      const squash = (v: string) => v.toLowerCase().replace(/[\s-]/g, '');
      const t = squash(term);
      rows = rows.filter((r) => r.name.toLowerCase().includes(term) || squash(r.cardNumber).includes(t));
    }

    const searched = rows.length;
    const matched = rows.filter((r) => r.listing).length;
    const underpriced = rows.filter((r) => r.underpriced).length;
    const matchableUnderpriced = rows.filter((r) => r.underpriced && r.matchPrice !== null && r.matchPrice > r.postedPrice).length;
    const changed = rows.filter((r) => r.changePhp !== null).length;
    const notLinked = rows.filter((r) => r.linkState === 'new').length;
    const linkMissing = rows.filter((r) => r.linkState === 'missing').length;

    rows = [...rows]; // never sort the cached array in place
    if (q.language) rows = rows.filter((r) => r.language === q.language);
    if (q.condition) rows = rows.filter((r) => r.condition === q.condition);
    if (q.underpricedOnly) rows = rows.filter((r) => r.underpriced);
    const view = q.view ?? 'changes';
    if (view === 'changes') rows = rows.filter((r) => r.changePhp !== null);
    if (view === 'unlinked') rows = rows.filter((r) => r.linkState !== 'linked');

    sortRows(rows, q.sort ?? (view === 'changes' ? 'change' : 'underpriced'));

    const total = rows.length;
    return {
      data: rows.slice(q.skip, q.skip + q.limit),
      meta: { total, page: q.page, limit: q.limit, totalPages: Math.ceil(total / q.limit) || 1 },
      summary: {
        rate: rates.jpy, usdRate: rates.usd, jpyDamagedRate: rates.jpyDamaged, usdDamagedRate: rates.usdDamaged,
        pct: rates.pct, cards: searched, matched, underpriced, matchableUnderpriced, changed, view,
        notLinked, linkMissing,
        slabsNotLinked: await this.prisma.slabCard.count({ where: { kind: 'SLAB', quantity: { gt: 0 }, marketListingKey: null } }),
        lastRun: all[LAST_RUN_KEY] ?? null, lastLink: all[LAST_LINK_KEY] ?? null, sync: this.status(),
      },
    };
  }

  /**
   * Dashboard inventory value for raw cards: market price × quantity, or 80%
   * of the posted price when a card has no market price yet. Recomputed on
   * every request, so it follows each sync automatically.
   */
  async rawInventoryValue() {
    const { rows } = await this.loadPriced();
    let market = 0, fallback = 0, matchedCards = 0;
    for (const r of rows) {
      if (r.marketPhp !== null) { market += r.marketPhp * r.quantity; matchedCards++; }
      else fallback += r.postedPrice * 0.8 * r.quantity;
    }
    return { total: market + fallback, market, fallback, matchedCards, fallbackCards: rows.length - matchedCards };
  }


  // ----------------------------- movers & lookups -----------------------------

  /** Biggest price moves since the last sync, one row per listing (for the dashboard). */
  async movers(limit = 5) {
    const { rows } = await this.loadPriced();
    const moved = dedupeByListing(sortedByMove(rows.filter((r) => r.changePhp !== null)));
    return {
      changed: moved.length,
      data: moved.slice(0, limit).map((r) => ({
        id: r.id, name: r.name, cardNumber: r.cardNumber, rarity: r.rarity, imageUrl: r.imageUrl,
        language: r.language, postedPrice: r.postedPrice, marketPhp: r.marketPhp, changePhp: r.changePhp,
        changePct: changePct(r), priceChangedAt: r.listing?.priceChangedAt ?? null,
      })),
    };
  }

  /** Market price per raw card id, for the Raw Cards page and the Sales wizard. */
  async forCards(ids: string[]) {
    const { rows } = await this.loadPriced();
    const want = new Set(ids);
    const out: Record<string, {
      marketPhp: number | null; matchPrice: number | null; diffPct: number | null; underpriced: boolean;
      changePhp: number | null; language: 'JP' | 'EN'; source: RowListing['source'] | null; listingName: string | null;
    }> = {};
    for (const r of rows) {
      if (!want.has(r.id)) continue;
      out[r.id] = {
        marketPhp: r.marketPhp, matchPrice: r.matchPrice, diffPct: r.diffPct, underpriced: r.underpriced,
        changePhp: r.changePhp, language: r.language, source: r.listing?.source ?? null, listingName: r.listing?.name ?? null,
      };
    }
    return out;
  }

  /**
   * Suggested posted price for a card being added: the same listing the sync
   * would pick for this number + rarity, converted at today's rate and rounded.
   * Numbers we don't stock yet (or haven't priced in the last day) are fetched
   * live once, then saved so the next lookup is instant.
   */
  async suggest(cardNumber: string, rarity: string, notes?: string | null) {
    const num = norm(cardNumber);
    const english = isEnglish(notes);
    const damage = damageReason(notes);
    const base = { cardNumber: num, rarity, language: english ? 'EN' as const : 'JP' as const, damage };
    const empty = (reason: string, candidates = 0) => ({
      ...base, found: false, reason, candidates, source: null, listingName: null, price: null, currency: null,
      rate: null, marketPhp: null, suggested: null, url: null, fetchedAt: null,
    });
    if (!/^[A-Z0-9]+-\d{2,3}$/.test(num)) return empty('Enter a card number like OP01-120');

    const { rates } = await this.rates();
    const rate = english
      ? (damage && rates.usdDamaged ? rates.usdDamaged : rates.usd)
      : (damage && rates.jpyDamaged ? rates.jpyDamaged : rates.jpy);

    let listing: { source: RowListing['source']; name: string; price: number; currency: 'JPY' | 'USD'; url: string; fetchedAt: Date } | null = null;
    let candidates = 0;
    if (english) {
      let pool = await this.prisma.tcgplayerPrice.findMany({ where: { cardNumber: num } });
      if (!isFresh(pool)) {
        await this.liveLookup(`t:${num}`, () => this.liveTcgplayer(num));
        pool = await this.prisma.tcgplayerPrice.findMany({ where: { cardNumber: num } });
      }
      candidates = pool.length;
      const t = pickTcgListing({ cardNumber: num, rarity }, pool.map((p) => ({ ...p, priceUsd: Number(p.priceUsd) })));
      if (t) listing = { source: 'TCGPLAYER', name: `${t.name} · ${t.subTypeName}`, price: t.priceUsd, currency: 'USD', url: t.url, fetchedAt: t.fetchedAt };
    } else {
      if (!toYuyuteiRarity(rarity)) return empty(`${rarity} cards can't be matched automatically. Save the card, then paste its Yuyu-tei link on Market Prices.`);
      const yWhere = { cardNumber: num, source: { in: YUYUTEI_SOURCES } };
      let pool = await this.prisma.marketPrice.findMany({ where: yWhere });
      if (!isFresh(pool)) {
        await this.liveLookup(`y:${num}`, async () => {
          const found = parseYuyuteiSearch(await fetchYuyuteiSearch(num)).filter((l) => l.cardNumber === num);
          if (found.length) await this.saveListings(num, found);
        });
        pool = await this.prisma.marketPrice.findMany({ where: yWhere });
      }
      candidates = pool.length;
      const y = pickAutoListing({ cardNumber: num, rarity }, pool);
      if (y) listing = { source: 'YUYUTEI', name: y.name, price: y.priceJpy, currency: 'JPY', url: y.url, fetchedAt: y.fetchedAt };
      else {
        // Not on Yuyu-tei: try Cardrush, the same backup Link uses.
        const d = pickCardrushListing({ cardNumber: num, rarity }, await this.cardrushPool(num));
        if (d) listing = { source: 'CARDRUSH', name: d.name, price: d.priceJpy, currency: 'JPY', url: d.url, fetchedAt: d.fetchedAt };
      }
    }

    if (!listing) {
      const reason = english
        ? (candidates ? `TCGplayer has ${num} but no ${rarity} version` : `TCGplayer has no listing for ${num}`)
        : (candidates ? `Yuyu-tei has ${num} but no ${rarity} version, and Cardrush doesn't either` : `Neither Yuyu-tei nor Cardrush lists ${num}`);
      return empty(reason, candidates);
    }
    const marketPhp = rate ? Math.round(listing.price * rate) : null;
    return {
      ...base, found: true,
      reason: rate ? null : `Set the ${english ? '₱ per $1' : '₱ per ¥1'} rate in Settings to get a peso price`,
      candidates, source: listing.source, listingName: listing.name, price: listing.price, currency: listing.currency,
      rate, marketPhp, suggested: marketPhp !== null ? roundPrice(marketPhp) : null, url: listing.url, fetchedAt: listing.fetchedAt,
    };
  }

  /** Runs a live fetch at most once per cooldown per key; concurrent callers share it. */
  private async liveLookup(key: string, run: () => Promise<void>) {
    const last = this.liveTried.get(key);
    if (last && Date.now() - last < LIVE_COOLDOWN_MS) return;
    let p = this.liveInFlight.get(key);
    if (!p) {
      p = run()
        .catch((e) => this.logger.warn(`Live price lookup ${key} failed: ${e?.message ?? e}`))
        .finally(() => {
          this.liveInFlight.delete(key);
          if (this.liveTried.size > 1000) this.liveTried.clear();
          this.liveTried.set(key, Date.now());
        });
      this.liveInFlight.set(key, p);
    }
    await p;
  }

  /** English card not priced yet: read just its home set (OP01 for OP01-xxx) from TCGCSV. */
  private async liveTcgplayer(num: string) {
    if (!this.tcgGroupsCache || Date.now() - this.tcgGroupsCache.at > 24 * 3_600_000) {
      this.tcgGroupsCache = { at: Date.now(), groups: await fetchGroups() };
    }
    const squash = (v: string) => v.toUpperCase().replace(/[\s-]/g, '');
    const home = squash(num.split('-')[0]);
    const group = this.tcgGroupsCache.groups.find((g) => squash(g.abbreviation ?? '') === home);
    if (!group) return;
    const products = await fetchProducts(group.groupId);
    await sleep(TCGCSV_DELAY_MS);
    const prices = await fetchPrices(group.groupId);
    const rows = joinGroup(group, products, prices, new Set([num]));
    if (rows.length) await this.prisma.$transaction(await this.tcgUpserts(rows));
  }

  /** One bell notification after a sync when cards moved more than the alert %. */
  private async notifyBigMoves(since: Date) {
    try {
      const all = await this.settings.getAll();
      const threshold = positive(all.priceAlertPct) ?? DEFAULT_ALERT_PCT;
      const { rows } = await this.loadPriced();
      const big = dedupeByListing(sortedByMove(rows.filter((r) => {
        const at = r.listing?.priceChangedAt;
        const pct = changePct(r);
        return r.changePhp !== null && !!at && at >= since && pct !== null && Math.abs(pct) >= threshold;
      })));
      if (!big.length) return;
      const peso = (n: number) => `₱${Math.abs(n).toLocaleString('en-PH')}`;
      const line = (r: PricedRow) => {
        const pct = changePct(r)!;
        return `${r.name} (${r.cardNumber}) ${r.changePhp! > 0 ? '▲' : '▼'} ${peso(r.changePhp!)} (${pct > 0 ? '+' : ''}${pct}%)`;
      };
      const shown = big.slice(0, 4).map(line);
      if (big.length > 4) shown.push(`+${big.length - 4} more`);
      await this.notifications.emit({
        type: 'SYSTEM',
        title: `${big.length} card${big.length === 1 ? '' : 's'} moved more than ${threshold}%`,
        body: shown.join(' · '),
      });
    } catch (e: any) {
      this.logger.warn(`Price alert skipped: ${e?.message ?? e}`);
    }
  }

  /**
   * Cardrush listings for a number, searched live when none are saved from the
   * last day. With throwOnError (the Cardrush tab), a failed search is reported
   * instead of looking like "no listings".
   */
  private async cardrushPool(num: string, throwOnError = false) {
    const where = { cardNumber: num, source: SOURCE_CARDRUSH };
    let pool = await this.prisma.marketPrice.findMany({ where });
    if (isFresh(pool)) return pool;
    if (throwOnError) {
      try {
        const found = await this.cardrushSearch(num);
        if (found.length) await this.saveListings(num, found, SOURCE_CARDRUSH);
      } catch (e: any) {
        if (pool.length) return pool; // keep showing what was saved before
        throw new BadRequestException(`Couldn't load Cardrush: ${e?.message ?? e}`);
      }
    } else {
      await this.liveLookup(`c:${num}`, async () => {
        const found = await this.cardrushSearch(num);
        if (found.length) await this.saveListings(num, found, SOURCE_CARDRUSH);
      });
    }
    pool = await this.prisma.marketPrice.findMany({ where });
    return pool;
  }

  /**
   * Match a card to a pasted Cardrush product link. Product pages aren't
   * parsed; the product is looked up in the search for the card's own number,
   * which is also how the sync keeps its price fresh.
   */
  private async linkCardrush(rawCardId: string, listingKey: string) {
    const card = await this.prisma.rawCard.findUnique({ where: { id: rawCardId }, select: { cardNumber: true } });
    if (!card) throw new NotFoundException('Raw card not found');
    const num = norm(card.cardNumber);
    let listings;
    try {
      listings = await this.cardrushSearch(num);
    } catch (e: any) {
      throw new BadRequestException(`Couldn't check that Cardrush link: ${e?.message ?? e}`);
    }
    const listing = listings.find((l) => l.listingKey === listingKey);
    if (!listing) {
      throw new BadRequestException(`That Cardrush product isn't in Cardrush's ${num} results. Check the card number, or pick from the Cardrush tab.`);
    }
    await this.saveListings(num, listings, SOURCE_CARDRUSH);
    await this.prisma.rawCard.update({ where: { id: rawCardId }, data: { marketListingKey: listingKey } });
    return listing;
  }

  // ----------------------------- slabs -----------------------------

  /** Graded Cardrush copies for the slab link picker (searches Cardrush if not fetched in the last day). */
  async slabCopies(slabId: string, cardNumber?: string) {
    const slab = await this.slabPrices.findSlab(slabId);
    const num = norm(cardNumber || slab.cardNumber || '');
    if (!num) throw new BadRequestException('Add the card number to this slab first (Edit), or type it in the search box.');
    await this.cardrushPool(num, true);
    return this.slabPrices.copiesFor(slab, num);
  }

  /** Link a slab: a Cardrush graded copy, "none", or null = find the exact match now. */
  async linkSlab(slabId: string, key: string | null) {
    if (key !== null) return this.slabPrices.link(slabId, key);
    const slab = await this.slabPrices.findSlab(slabId);
    await this.prisma.slabCard.update({ where: { id: slabId }, data: { marketListingKey: null } });
    if (slab.cardNumber) await this.cardrushPool(norm(slab.cardNumber));
    const r = await this.slabPrices.autoLink([slab]);
    return { id: slabId, marketListingKey: r.keys.get(slabId) ?? null };
  }

  /** Link a slab by pasting a Cardrush product link of a graded copy. */
  async linkSlabUrl(slabId: string, input: string) {
    const parsed = parseCardrushProductUrl(input);
    if (!parsed) throw new BadRequestException('Paste a Cardrush product link, e.g. https://www.cardrush-op.jp/product/2573');
    const slab = await this.slabPrices.findSlab(slabId);
    if (!slab.cardNumber) throw new BadRequestException('Add the card number to this slab first (Edit).');
    const num = norm(slab.cardNumber);
    let listings;
    try {
      listings = await this.cardrushSearch(num);
    } catch (e: any) {
      throw new BadRequestException(`Couldn't check that Cardrush link: ${e?.message ?? e}`);
    }
    if (!listings.some((l) => l.listingKey === parsed.listingKey)) {
      throw new BadRequestException(`That Cardrush product isn't in Cardrush's ${num} results. Check the slab's card number.`);
    }
    await this.saveListings(num, listings, SOURCE_CARDRUSH);
    return this.slabPrices.link(slabId, parsed.listingKey);
  }

  // ----------------------------- match -----------------------------

  /** Set one card's posted price to its rounded market price (up or down). */
  async matchOne(rawCardId: string, userId: string) {
    const { rates } = await this.rates();
    const card = await this.prisma.rawCard.findUnique({ where: { id: rawCardId }, select: CARD_SELECT });
    if (!card) throw new NotFoundException('Raw card not found');
    const [row] = await this.priceCards([card], rates);
    if (row.marketPhp === null) {
      throw new BadRequestException('No market price for this card yet. Match it to a listing and set the exchange rate first.');
    }
    if (row.matchPrice === null) return { id: card.id, from: row.postedPrice, to: row.postedPrice, changed: false };
    await this.rawCards.update(card.id, { postedPrice: row.matchPrice });
    await this.audit.log({
      userId, action: 'market-prices.match', entityType: 'RawCard', entityId: card.id,
      metadata: { name: card.name, from: row.postedPrice, to: row.matchPrice, source: row.listing?.source },
    });
    return { id: card.id, from: row.postedPrice, to: row.matchPrice, changed: true };
  }

  /** Raise every underpriced in-stock card to its rounded market price. */
  async matchAllUnderpriced(userId: string) {
    const { rows: priced } = await this.loadPriced();
    const changes = priced
      .filter((r) => r.underpriced && r.matchPrice !== null && r.matchPrice > r.postedPrice)
      .map((r) => ({ id: r.id, name: r.name, from: r.postedPrice, to: r.matchPrice! }));
    // One batched transaction: every price update plus its price-history row,
    // the same records RawCardsService.update writes for a posted-price change.
    if (changes.length) {
      await this.prisma.$transaction([
        ...changes.map((c) => this.prisma.rawCard.update({
          where: { id: c.id }, data: { postedPrice: new Prisma.Decimal(c.to) },
        })),
        this.prisma.priceHistory.createMany({
          data: changes.map((c) => ({
            itemType: 'RAW' as const, itemId: c.id, field: 'postedPrice',
            oldValue: new Prisma.Decimal(c.from), newValue: new Prisma.Decimal(c.to),
          })),
        }),
      ]);
    }
    if (changes.length) {
      await this.audit.log({
        userId, action: 'market-prices.match-all', entityType: 'RawCard',
        metadata: { count: changes.length, changes: changes.slice(0, 200) },
      });
    }
    return { updated: changes.length, changes };
  }

  // ----------------------------- manual links -----------------------------

  /** Every listing for a card number, for the manual match picker. */
  async listingsFor(cardNumber: string, source: 'YUYUTEI' | 'CARDRUSH' | 'TCGPLAYER' = 'YUYUTEI') {
    const num = norm(cardNumber);
    if (source === 'TCGPLAYER') {
      const rows = await this.prisma.tcgplayerPrice.findMany({ where: { cardNumber: num }, orderBy: [{ priceUsd: 'asc' }] });
      return rows.map((t) => ({
        source, listingKey: t.listingKey, cardNumber: t.cardNumber, name: `${t.name} · ${t.subTypeName}`,
        rarity: t.rarity, setLabel: t.groupAbbr ?? String(t.groupId), price: Number(t.priceUsd), currency: 'USD',
        inStock: null, stockCount: null, url: t.url,
      }));
    }
    if (source === 'CARDRUSH') {
      const rows = [...(await this.cardrushPool(num, true))].sort((a, b) => a.rarity.localeCompare(b.rarity) || a.priceJpy - b.priceJpy);
      return rows.map((l) => ({
        source, listingKey: l.listingKey, cardNumber: l.cardNumber, name: l.name, rarity: l.rarity,
        setLabel: 'Cardrush', price: l.priceJpy, currency: 'JPY',
        inStock: l.inStock, stockCount: l.stockCount, url: l.url,
      }));
    }
    const rows = await this.prisma.marketPrice.findMany({
      where: { cardNumber: num, source: { in: YUYUTEI_SOURCES } }, orderBy: [{ rarity: 'asc' }, { priceJpy: 'asc' }],
    });
    return rows.map((l) => ({
      source, listingKey: l.listingKey, cardNumber: l.cardNumber, name: l.name, rarity: l.rarity,
      setLabel: l.listingKey.split('/')[0].toUpperCase(), price: l.priceJpy, currency: 'JPY',
      inStock: l.inStock, stockCount: l.stockCount, url: l.url,
    }));
  }

  /**
   * Pin a card to a specific listing, or "none" for no market price. null means
   * "link automatically now": the same Yuyu-tei → Cardrush / TCGplayer search
   * Link new stock does, for this one card.
   */
  async link(rawCardId: string, listingKey: string | null) {
    const card = await this.prisma.rawCard.findUnique({
      where: { id: rawCardId }, select: { id: true, cardNumber: true, rarity: true, notes: true },
    });
    if (!card) throw new NotFoundException('Raw card not found');
    if (listingKey === null) {
      await this.prisma.rawCard.update({ where: { id: rawCardId }, data: { marketListingKey: null } });
      const found = await this.autoLink([card], false);
      return { id: rawCardId, marketListingKey: found.get(card.id) ?? null };
    }
    if (listingKey && listingKey !== NO_MATCH) {
      const l = listingKey.startsWith(TCG_PREFIX)
        ? await this.prisma.tcgplayerPrice.findUnique({ where: { listingKey } })
        : await this.prisma.marketPrice.findUnique({ where: { listingKey } });
      if (!l || l.cardNumber !== norm(card.cardNumber)) {
        throw new NotFoundException('That listing is not for this card number');
      }
    }
    await this.prisma.rawCard.update({ where: { id: rawCardId }, data: { marketListingKey: listingKey } });
    return { id: rawCardId, marketListingKey: listingKey };
  }

  /**
   * Match a card to a Yuyu-tei card page the owner pasted, for cards the
   * search can't find (e.g. DON!! cards). Fetches the page once now so the
   * price shows immediately; the nightly sync keeps it fresh.
   */
  async linkByUrl(rawCardId: string, input: string) {
    const cardrush = parseCardrushProductUrl(input);
    if (cardrush) return this.linkCardrush(rawCardId, cardrush.listingKey);
    const parsed = parseYuyuteiCardUrl(input);
    if (!parsed) {
      throw new BadRequestException('Paste a Yuyu-tei or Cardrush card link, e.g. https://yuyu-tei.jp/sell/opc/card/prb02/10217');
    }
    const card = await this.prisma.rawCard.findUnique({ where: { id: rawCardId }, select: { id: true } });
    if (!card) throw new NotFoundException('Raw card not found');

    let listing: YuyuteiListing | null;
    try {
      listing = parseYuyuteiCardPage(await fetchYuyuteiCardPage(parsed.ver, parsed.cid));
    } catch (e: any) {
      throw new BadRequestException(`Couldn't open that Yuyu-tei page (${e?.message ?? e}). Try again in a moment.`);
    }
    if (!listing || listing.listingKey !== parsed.listingKey) {
      throw new BadRequestException("That page didn't look like a Yuyu-tei card page. Check the link.");
    }
    const saved = await this.saveLinked(listing);
    await this.prisma.rawCard.update({ where: { id: rawCardId }, data: { marketListingKey: saved.listingKey } });
    return saved;
  }
}

/** Peso change as a % of the old price, one decimal. */
function changePct(r: { marketPhp: number | null; changePhp: number | null }): number | null {
  if (r.marketPhp === null || r.changePhp === null) return null;
  const before = r.marketPhp - r.changePhp;
  return before > 0 ? Math.round((r.changePhp / before) * 1000) / 10 : null;
}

/** Biggest move first (copy; never sorts the cached array). */
function sortedByMove<T extends PricedRow>(rows: T[]): T[] {
  const copy = [...rows];
  sortRows(copy, 'change');
  return copy;
}

/** Keep the first row per listing, so a clean and a damaged copy of one card count once. */
function dedupeByListing<T extends { listing: { listingKey: string } | null }>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((r) => {
    const k = r.listing?.listingKey;
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Every listing was fetched within the last day. */
const isFresh = (rows: { fetchedAt: Date }[]) =>
  rows.length > 0 && rows.every((r) => Date.now() - r.fetchedAt.getTime() < CHANGE_WINDOW_MS);

function groupBy<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const it of items) {
    const k = key(it);
    const arr = m.get(k) ?? [];
    arr.push(it);
    m.set(k, arr);
  }
  return m;
}

/** Fields to set when a synced price differs from the stored one. */
export function changeFields<K extends 'prevPriceJpy' | 'prevPriceUsd'>(
  oldPrice: number | undefined, newPrice: number, key: K, at: Date,
): Partial<Record<K, number> & { priceChangedAt: Date }> {
  if (oldPrice === undefined || Math.abs(oldPrice - newPrice) < 0.005) return {};
  return { [key]: oldPrice, priceChangedAt: at } as Record<K, number> & { priceChangedAt: Date };
}

export type MarketSort = 'change' | 'price_desc' | 'price_asc' | 'recent' | 'margin_desc' | 'underpriced';

/** Sort in place. Rows missing the sort value always go last. */
export function sortRows<T extends {
  name: string; changePhp: number | null; marketPhp: number | null; createdAt: Date;
  marginPct: number | null; diffPct: number | null;
}>(rows: T[], sort: MarketSort) {
  const last = (v: number | null) => (v === null ? 1 : 0);
  const by = (pick: (r: T) => number | null, dir: 1 | -1) => (a: T, b: T) =>
    last(pick(a)) - last(pick(b)) || dir * ((pick(a) ?? 0) - (pick(b) ?? 0)) || a.name.localeCompare(b.name);
  const cmp: Record<MarketSort, (a: T, b: T) => number> = {
    change: by((r) => (r.changePhp === null ? null : Math.abs(r.changePhp)), -1),
    price_desc: by((r) => r.marketPhp, -1),
    price_asc: by((r) => r.marketPhp, 1),
    recent: (a, b) => b.createdAt.getTime() - a.createdAt.getTime() || a.name.localeCompare(b.name),
    margin_desc: by((r) => r.marginPct, -1),
    underpriced: by((r) => r.diffPct, 1),
  };
  rows.sort(cmp[sort]);
}

