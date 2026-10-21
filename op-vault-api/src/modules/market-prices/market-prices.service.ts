import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MarketPrice, Prisma, TcgplayerPrice } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { RawCardsService } from '../raw-cards/raw-cards.service';
import { fetchYuyuteiCardPage, fetchYuyuteiSearch } from './yuyutei.client';
import { parseYuyuteiCardPage, parseYuyuteiCardUrl, parseYuyuteiSearch, YuyuteiListing } from './yuyutei.parser';
import { fetchGroups, fetchPrices, fetchProducts } from './tcgcsv.client';
import { groupHasWanted, joinGroup, TcgRow } from './tcgcsv.parser';
import {
  comparePrice, damageReason, isEnglish, pickAutoListing, pickTcgListing, roundPrice,
} from './market-match';
import { QueryMarketPricesDto } from './dto/query-market-prices.dto';

const DELAY_MS = 1500;          // gap between Yuyu-tei requests — be a polite visitor
const TCGCSV_DELAY_MS = 300;    // TCGCSV asks for a short pause between requests
const LAST_RUN_KEY = 'marketSyncLastRun';
// Listings found by card-number search vs. pasted by the owner as a direct link.
// Linked ones are refreshed from their own page and never pruned by a search.
const SOURCE_SEARCH = 'YUYUTEI';
const SOURCE_LINK = 'YUYUTEI_LINK';
const TCG_PREFIX = 'tcgp:';
// "Changed today" window: a little over a day so the 3 AM sync's changes stay
// visible until the next one lands.
const CHANGE_WINDOW_MS = 26 * 60 * 60 * 1000;

export interface SyncState {
  running: boolean;
  trigger: 'nightly' | 'manual' | null;
  phase: 'yuyutei' | 'tcgplayer' | null;
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
  source: 'YUYUTEI' | 'TCGPLAYER';
  listingKey: string;
  name: string;
  rarity: string | null;
  price: number;
  currency: 'JPY' | 'USD';
  inStock: boolean | null;      // TCGCSV doesn't report stock
  stockCount: number | null;
  url: string;
  fetchedAt: Date;
  manual: boolean;
  viaLink: boolean;
  prevPrice: number | null;      // foreign price before the last change
  priceChangedAt: Date | null;
}

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

@Injectable()
export class MarketPricesService {
  private readonly logger = new Logger(MarketPricesService.name);
  private state: SyncState = {
    running: false, trigger: null, phase: null, total: 0, done: 0, failed: 0, empty: 0,
    startedAt: null, finishedAt: null, lastError: null,
  };

  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
    private audit: ActivityLogsService,
    private rawCards: RawCardsService,
  ) {}

  // ----------------------------- sync -----------------------------

  /** 3:00 AM Philippine time. Needs the Render service awake (keep-alive ping). */
  @Cron('0 3 * * *', { name: 'yuyutei-sync', timeZone: 'Asia/Manila' })
  async nightly() {
    await this.runSync('nightly');
  }

  status(): SyncState {
    return { ...this.state };
  }

  /** Starts a sync in the background and returns immediately. */
  startManual(): SyncState {
    if (!this.state.running) {
      this.runSync('manual').catch((e) => this.logger.error(`Sync crashed: ${e?.message ?? e}`));
    }
    return this.status();
  }

  private async runSync(trigger: 'nightly' | 'manual') {
    if (this.state.running) return;
    // Claim the lock before the first await so two triggers can't both start.
    this.state = { ...this.state, running: true, trigger, phase: 'yuyutei', total: 0, done: 0, failed: 0, empty: 0,
      startedAt: new Date().toISOString(), finishedAt: null, lastError: null };
    try {
      const cards = await this.prisma.rawCard.findMany({
        where: { quantity: { gt: 0 } }, select: { cardNumber: true, marketListingKey: true, notes: true },
      });
      const japanese = cards.filter((c) => !isEnglish(c.notes));
      const english = cards.filter((c) => isEnglish(c.notes));

      // Japanese cards pinned to a pasted link are refreshed from that page;
      // everything else is found by searching its card number.
      const linked = new Set((await this.prisma.marketPrice.findMany({
        where: { source: SOURCE_LINK, listingKey: { in: japanese.map((c) => c.marketListingKey).filter((k): k is string => !!k) } },
        select: { listingKey: true },
      })).map((l) => l.listingKey));
      const numbers = [...new Set(japanese
        .filter((c) => !(c.marketListingKey && linked.has(c.marketListingKey)))
        .map((c) => norm(c.cardNumber)).filter(Boolean))].sort();
      const links = [...linked].sort();
      const englishNumbers = new Set(english.map((c) => norm(c.cardNumber)).filter(Boolean));
      this.state.total = numbers.length + links.length;
      this.logger.log(`Price sync (${trigger}): ${numbers.length} Yuyu-tei searches, ${links.length} linked pages, ${englishNumbers.size} English card numbers`);

      for (const [i, num] of numbers.entries()) {
        if (i > 0) await sleep(DELAY_MS);
        try {
          const html = await this.withRetry(() => fetchYuyuteiSearch(num));
          const listings = parseYuyuteiSearch(html).filter((l) => l.cardNumber === num);
          if (listings.length) await this.saveListings(num, listings);
          else this.state.empty++;
        } catch (e: any) {
          this.recordFailure(num, e);
        }
        this.state.done++;
      }

      for (const key of links) {
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

      if (englishNumbers.size) await this.syncTcgplayer(englishNumbers);
    } catch (e: any) {
      this.state.lastError = e?.message ?? String(e);
      this.logger.error(`Price sync aborted: ${this.state.lastError}`);
    } finally {
      this.state.running = false;
      this.state.phase = null;
      this.state.finishedAt = new Date().toISOString();
      const summary = { ...this.state } as unknown as Prisma.InputJsonValue;
      await this.prisma.setting.upsert({
        where: { key: LAST_RUN_KEY }, update: { value: summary }, create: { key: LAST_RUN_KEY, value: summary },
      }).catch(() => undefined);
      this.logger.log(`Price sync finished: ${this.state.done}/${this.state.total}, ${this.state.failed} failed`);
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

    const fetchedAt = new Date();
    const old = new Map((await this.prisma.tcgplayerPrice.findMany({
      where: { listingKey: { in: rows.map((r) => r.listingKey) } }, select: { listingKey: true, priceUsd: true },
    })).map((o) => [o.listingKey, Number(o.priceUsd)]));
    await this.prisma.$transaction([
      ...rows.map((r) => {
        const data = { ...r, priceUsd: new Prisma.Decimal(r.priceUsd.toFixed(2)), fetchedAt };
        const change = changeFields(old.get(r.listingKey), r.priceUsd, 'prevPriceUsd', fetchedAt);
        return this.prisma.tcgplayerPrice.upsert({ where: { listingKey: r.listingKey }, update: { ...data, ...change }, create: data });
      }),
      // Only prune when every set was read, so a TCGCSV hiccup never wipes prices.
      ...(groupFailures === 0 ? [this.prisma.tcgplayerPrice.deleteMany({
        where: { cardNumber: { in: [...wanted] }, listingKey: { notIn: rows.map((r) => r.listingKey) } },
      })] : []),
    ]);
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

  /** Upsert this card number's listings and drop ones Yuyu-tei no longer shows. */
  private async saveListings(num: string, listings: YuyuteiListing[]) {
    const fetchedAt = new Date();
    const old = new Map((await this.prisma.marketPrice.findMany({
      where: { listingKey: { in: listings.map((l) => l.listingKey) } }, select: { listingKey: true, priceJpy: true },
    })).map((o) => [o.listingKey, o.priceJpy]));
    await this.prisma.$transaction([
      ...listings.map((l) => this.prisma.marketPrice.upsert({
        where: { listingKey: l.listingKey },
        update: { ...l, fetchedAt, ...changeFields(old.get(l.listingKey), l.priceJpy, 'prevPriceJpy', fetchedAt) },
        create: { ...l, fetchedAt },
      })),
      this.prisma.marketPrice.deleteMany({
        where: { cardNumber: num, source: SOURCE_SEARCH, listingKey: { notIn: listings.map((l) => l.listingKey) } },
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
    const jpManual = jpCards.map((c) => c.marketListingKey).filter((k): k is string => !!k && !k.startsWith(TCG_PREFIX));
    const yuyutei = jpCards.length
      ? await this.prisma.marketPrice.findMany({
          where: { OR: [{ cardNumber: { in: jpNumbers } }, { listingKey: { in: jpManual } }] },
        })
      : [];
    const enNumbers = [...new Set(enCards.map((c) => norm(c.cardNumber)))];
    const tcg = enCards.length
      ? await this.prisma.tcgplayerPrice.findMany({ where: { cardNumber: { in: enNumbers } } })
      : [];

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

      if (english) {
        const pool = (tByNum.get(norm(c.cardNumber)) ?? []).map(tcgLike);
        candidateCount = pool.length;
        const manualRaw = c.marketListingKey?.startsWith(TCG_PREFIX) ? tByKey.get(c.marketListingKey) : undefined;
        const manual = manualRaw ? tcgLike(manualRaw) : undefined;
        const t = manual ?? pickTcgListing(c, pool);
        if (t) {
          listing = {
            source: 'TCGPLAYER', listingKey: t.listingKey, name: `${t.name} · ${t.subTypeName}`, rarity: t.rarity,
            price: t.priceUsd, currency: 'USD', inStock: null, stockCount: null,
            url: t.url, fetchedAt: t.fetchedAt, manual: !!manual, viaLink: false,
            prevPrice: t.prevPriceUsd != null ? Number(t.prevPriceUsd) : null, priceChangedAt: t.priceChangedAt,
          };
        }
      } else {
        const pool = yByNum.get(norm(c.cardNumber)) ?? [];
        candidateCount = pool.length;
        const manual = c.marketListingKey && !c.marketListingKey.startsWith(TCG_PREFIX)
          ? yByKey.get(c.marketListingKey) : undefined;
        const y: MarketPrice | null = manual ?? pickAutoListing(c, pool);
        if (y) {
          listing = {
            source: 'YUYUTEI', listingKey: y.listingKey, name: y.name, rarity: y.rarity,
            price: y.priceJpy, currency: 'JPY', inStock: y.inStock, stockCount: y.stockCount,
            url: y.url, fetchedAt: y.fetchedAt, manual: !!manual, viaLink: y.source === SOURCE_LINK,
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

  async list(q: QueryMarketPricesDto) {
    const { rates, all } = await this.rates();
    const where: Prisma.RawCardWhereInput = { quantity: { gt: 0 } };
    const term = q.search?.trim();
    if (term) {
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { cardNumber: { contains: term, mode: 'insensitive' } },
      ];
    }
    const cards = await this.prisma.rawCard.findMany({ where, select: CARD_SELECT });
    let rows = await this.priceCards(cards, rates);

    const matched = rows.filter((r) => r.listing).length;
    const underpriced = rows.filter((r) => r.underpriced).length;
    const matchableUnderpriced = rows.filter((r) => r.underpriced && r.matchPrice !== null && r.matchPrice > r.postedPrice).length;
    const changed = rows.filter((r) => r.changePhp !== null).length;

    if (q.language) rows = rows.filter((r) => r.language === q.language);
    if (q.condition) rows = rows.filter((r) => r.condition === q.condition);
    if (q.underpricedOnly) rows = rows.filter((r) => r.underpriced);
    const view = q.view ?? 'changes';
    if (view === 'changes') rows = rows.filter((r) => r.changePhp !== null);

    sortRows(rows, q.sort ?? (view === 'changes' ? 'change' : 'underpriced'));

    const total = rows.length;
    return {
      data: rows.slice(q.skip, q.skip + q.limit),
      meta: { total, page: q.page, limit: q.limit, totalPages: Math.ceil(total / q.limit) || 1 },
      summary: {
        rate: rates.jpy, usdRate: rates.usd, jpyDamagedRate: rates.jpyDamaged, usdDamagedRate: rates.usdDamaged,
        pct: rates.pct, cards: cards.length, matched, underpriced, matchableUnderpriced, changed, view,
        lastRun: all[LAST_RUN_KEY] ?? null, sync: this.status(),
      },
    };
  }

  /**
   * Dashboard inventory value for raw cards: market price × quantity, or 80%
   * of the posted price when a card has no market price yet. Recomputed on
   * every request, so it follows each sync automatically.
   */
  async rawInventoryValue() {
    const { rates } = await this.rates();
    const cards = await this.prisma.rawCard.findMany({ where: { quantity: { gt: 0 } }, select: CARD_SELECT });
    const rows = await this.priceCards(cards, rates);
    let market = 0, fallback = 0, matchedCards = 0;
    for (const r of rows) {
      if (r.marketPhp !== null) { market += r.marketPhp * r.quantity; matchedCards++; }
      else fallback += r.postedPrice * 0.8 * r.quantity;
    }
    return { total: market + fallback, market, fallback, matchedCards, fallbackCards: rows.length - matchedCards };
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
    const { rates } = await this.rates();
    const cards = await this.prisma.rawCard.findMany({ where: { quantity: { gt: 0 } }, select: CARD_SELECT });
    const rows = (await this.priceCards(cards, rates))
      .filter((r) => r.underpriced && r.matchPrice !== null && r.matchPrice > r.postedPrice);
    const changes: { id: string; name: string; from: number; to: number }[] = [];
    for (const r of rows) {
      await this.rawCards.update(r.id, { postedPrice: r.matchPrice! });
      changes.push({ id: r.id, name: r.name, from: r.postedPrice, to: r.matchPrice! });
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
  async listingsFor(cardNumber: string, source: 'YUYUTEI' | 'TCGPLAYER' = 'YUYUTEI') {
    const num = norm(cardNumber);
    if (source === 'TCGPLAYER') {
      const rows = await this.prisma.tcgplayerPrice.findMany({ where: { cardNumber: num }, orderBy: [{ priceUsd: 'asc' }] });
      return rows.map((t) => ({
        source, listingKey: t.listingKey, cardNumber: t.cardNumber, name: `${t.name} · ${t.subTypeName}`,
        rarity: t.rarity, setLabel: t.groupAbbr ?? String(t.groupId), price: Number(t.priceUsd), currency: 'USD',
        inStock: null, stockCount: null, url: t.url,
      }));
    }
    const rows = await this.prisma.marketPrice.findMany({
      where: { cardNumber: num }, orderBy: [{ rarity: 'asc' }, { priceJpy: 'asc' }],
    });
    return rows.map((l) => ({
      source, listingKey: l.listingKey, cardNumber: l.cardNumber, name: l.name, rarity: l.rarity,
      setLabel: l.listingKey.split('/')[0].toUpperCase(), price: l.priceJpy, currency: 'JPY',
      inStock: l.inStock, stockCount: l.stockCount, url: l.url,
    }));
  }

  /** Pin a card to a specific listing, or pass null to go back to automatic. */
  async link(rawCardId: string, listingKey: string | null) {
    const card = await this.prisma.rawCard.findUnique({ where: { id: rawCardId }, select: { cardNumber: true } });
    if (!card) throw new NotFoundException('Raw card not found');
    if (listingKey) {
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
    const parsed = parseYuyuteiCardUrl(input);
    if (!parsed) {
      throw new BadRequestException('Paste a Yuyu-tei card link like https://yuyu-tei.jp/sell/opc/card/prb02/10217');
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

