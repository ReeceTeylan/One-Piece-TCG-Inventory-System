import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MarketPrice, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { fetchYuyuteiCardPage, fetchYuyuteiSearch } from './yuyutei.client';
import { parseYuyuteiCardPage, parseYuyuteiCardUrl, parseYuyuteiSearch, YuyuteiListing } from './yuyutei.parser';
import { comparePrice, pickAutoListing } from './market-match';
import { QueryMarketPricesDto } from './dto/query-market-prices.dto';

const DELAY_MS = 1500;          // gap between Yuyu-tei requests — be a polite visitor
const LAST_RUN_KEY = 'marketSyncLastRun';
// Listings found by card-number search vs. pasted by the owner as a direct link.
// Linked ones are refreshed from their own page and never pruned by a search.
const SOURCE_SEARCH = 'YUYUTEI';
const SOURCE_LINK = 'YUYUTEI_LINK';

export interface SyncState {
  running: boolean;
  trigger: 'nightly' | 'manual' | null;
  total: number;
  done: number;
  failed: number;
  empty: number;                // card numbers Yuyu-tei returned no listings for
  startedAt: string | null;
  finishedAt: string | null;
  lastError: string | null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const norm = (n: string) => n.trim().toUpperCase();

@Injectable()
export class MarketPricesService {
  private readonly logger = new Logger(MarketPricesService.name);
  private state: SyncState = {
    running: false, trigger: null, total: 0, done: 0, failed: 0, empty: 0,
    startedAt: null, finishedAt: null, lastError: null,
  };

  constructor(private prisma: PrismaService, private settings: SettingsService) {}

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
    this.state = { ...this.state, running: true, trigger, total: 0, done: 0, failed: 0, empty: 0,
      startedAt: new Date().toISOString(), finishedAt: null, lastError: null };
    try {
      const cards = await this.prisma.rawCard.findMany({
        where: { quantity: { gt: 0 } }, select: { cardNumber: true, marketListingKey: true },
      });
      // Cards pinned to a pasted link are refreshed from that page; everything
      // else is found by searching its card number.
      const linked = new Set((await this.prisma.marketPrice.findMany({
        where: { source: SOURCE_LINK, listingKey: { in: cards.map((c) => c.marketListingKey).filter((k): k is string => !!k) } },
        select: { listingKey: true },
      })).map((l) => l.listingKey));
      const numbers = [...new Set(cards
        .filter((c) => !(c.marketListingKey && linked.has(c.marketListingKey)))
        .map((c) => norm(c.cardNumber)).filter(Boolean))].sort();
      const links = [...linked].sort();
      this.state.total = numbers.length + links.length;
      this.logger.log(`Yuyu-tei sync (${trigger}) started: ${numbers.length} searches, ${links.length} linked pages`);

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
    } catch (e: any) {
      this.state.lastError = e?.message ?? String(e);
      this.logger.error(`Yuyu-tei sync aborted: ${this.state.lastError}`);
    } finally {
      this.state.running = false;
      this.state.finishedAt = new Date().toISOString();
      const summary = { ...this.state } as unknown as Prisma.InputJsonValue;
      await this.prisma.setting.upsert({
        where: { key: LAST_RUN_KEY }, update: { value: summary }, create: { key: LAST_RUN_KEY, value: summary },
      }).catch(() => undefined);
      this.logger.log(`Yuyu-tei sync finished: ${this.state.done}/${this.state.total}, ${this.state.failed} failed`);
    }
  }

  private async withRetry(fetchPage: () => Promise<string>) {
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
    this.logger.warn(`Yuyu-tei ${what} failed: ${e?.message ?? e}`);
  }

  private saveLinked(l: YuyuteiListing) {
    const fetchedAt = new Date();
    return this.prisma.marketPrice.upsert({
      where: { listingKey: l.listingKey },
      update: { ...l, source: SOURCE_LINK, fetchedAt },
      create: { ...l, source: SOURCE_LINK, fetchedAt },
    });
  }

  /** Upsert this card number's listings and drop ones Yuyu-tei no longer shows. */
  private async saveListings(num: string, listings: YuyuteiListing[]) {
    const fetchedAt = new Date();
    await this.prisma.$transaction([
      ...listings.map((l) => this.prisma.marketPrice.upsert({
        where: { listingKey: l.listingKey },
        update: { ...l, fetchedAt },
        create: { ...l, fetchedAt },
      })),
      this.prisma.marketPrice.deleteMany({
        where: { cardNumber: num, source: SOURCE_SEARCH, listingKey: { notIn: listings.map((l) => l.listingKey) } },
      }),
    ]);
  }

  // ----------------------------- read -----------------------------

  async list(q: QueryMarketPricesDto) {
    const all = await this.settings.getAll();
    const rate = Number(all.jpyToPhpRate) > 0 ? Number(all.jpyToPhpRate) : null;
    const pct = Number(all.underpricedPct) > 0 ? Number(all.underpricedPct) : 90;

    const where: Prisma.RawCardWhereInput = { quantity: { gt: 0 } };
    const term = q.search?.trim();
    if (term) {
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { cardNumber: { contains: term, mode: 'insensitive' } },
      ];
    }
    const cards = await this.prisma.rawCard.findMany({
      where,
      select: {
        id: true, name: true, cardNumber: true, rarity: true, setName: true, quantity: true,
        postedPrice: true, marketListingKey: true,
        images: { take: 1, select: { url: true } },
      },
    });

    const numbers = [...new Set(cards.map((c) => norm(c.cardNumber)))];
    const manualKeys = cards.map((c) => c.marketListingKey).filter((k): k is string => !!k);
    const listings = cards.length
      ? await this.prisma.marketPrice.findMany({
          where: { OR: [{ cardNumber: { in: numbers } }, { listingKey: { in: manualKeys } }] },
        })
      : [];
    const byKey = new Map(listings.map((l) => [l.listingKey, l]));
    const byNumber = new Map<string, MarketPrice[]>();
    for (const l of listings) {
      const arr = byNumber.get(l.cardNumber) ?? [];
      arr.push(l);
      byNumber.set(l.cardNumber, arr);
    }

    let rows = cards.map((c) => {
      const pool = byNumber.get(norm(c.cardNumber)) ?? [];
      const manual = c.marketListingKey ? byKey.get(c.marketListingKey) : undefined;
      const listing = manual ?? pickAutoListing(c, pool);
      const posted = Number(c.postedPrice);
      const cmp = listing ? comparePrice(posted, listing.priceJpy, rate, pct)
        : { marketPhp: null, diffPct: null, underpriced: false };
      return {
        id: c.id, name: c.name, cardNumber: c.cardNumber, rarity: c.rarity, setName: c.setName,
        quantity: c.quantity, postedPrice: posted, imageUrl: c.images[0]?.url ?? null,
        listing: listing ? {
          listingKey: listing.listingKey, name: listing.name, rarity: listing.rarity,
          priceJpy: listing.priceJpy, inStock: listing.inStock, stockCount: listing.stockCount,
          url: listing.url, fetchedAt: listing.fetchedAt, manual: !!manual,
          viaLink: listing.source === SOURCE_LINK,
        } : null,
        candidateCount: pool.length,
        ...cmp,
      };
    });

    const matched = rows.filter((r) => r.listing).length;
    const underpriced = rows.filter((r) => r.underpriced).length;
    if (q.underpricedOnly) rows = rows.filter((r) => r.underpriced);

    // Most underpriced first; unmatched cards last.
    rows.sort((a, b) =>
      (a.diffPct === null ? 1 : 0) - (b.diffPct === null ? 1 : 0)
      || (a.diffPct ?? 0) - (b.diffPct ?? 0)
      || a.name.localeCompare(b.name));

    const total = rows.length;
    return {
      data: rows.slice(q.skip, q.skip + q.limit),
      meta: { total, page: q.page, limit: q.limit, totalPages: Math.ceil(total / q.limit) || 1 },
      summary: {
        rate, pct, cards: cards.length, matched, underpriced,
        lastRun: all[LAST_RUN_KEY] ?? null, sync: this.status(),
      },
    };
  }

  /** Every Yuyu-tei listing for a card number, for the manual match picker. */
  listingsFor(cardNumber: string) {
    return this.prisma.marketPrice.findMany({
      where: { cardNumber: norm(cardNumber) },
      orderBy: [{ rarity: 'asc' }, { priceJpy: 'asc' }],
    });
  }

  /** Pin a card to a specific listing, or pass null to go back to automatic. */
  async link(rawCardId: string, listingKey: string | null) {
    const card = await this.prisma.rawCard.findUnique({ where: { id: rawCardId }, select: { cardNumber: true } });
    if (!card) throw new NotFoundException('Raw card not found');
    if (listingKey) {
      const l = await this.prisma.marketPrice.findUnique({ where: { listingKey } });
      if (!l || l.cardNumber !== norm(card.cardNumber)) {
        throw new NotFoundException('That Yuyu-tei listing is not for this card number');
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
