import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { CARDRUSH_PREFIX } from './cardrush.parser';
import { GradedCopy, gradedCopies, gradeText, groupPrice, pickSlabCopy, sameGrade, sameGroup } from './slab-match';

const NO_MATCH = 'none';
const SOURCE_CARDRUSH = 'CARDRUSH';
const norm = (n: string) => n.trim().toUpperCase();
const positive = (v: unknown) => (Number(v) > 0 ? Number(v) : null);

export type SlabLinkState = 'linked' | 'new' | 'none' | 'missing';

type SlabForLink = { id: string; cardNumber: string | null; rarity: string | null; gradingCompany: string | null; grade: unknown };

/**
 * Graded slab prices from Cardrush's graded copies (〔PSA10鑑定済〕…). A slab is
 * linked to one Cardrush copy of the exact card, version, company and grade;
 * its price is the lower of "last sold" and "lowest listed" across every
 * identical copy. Database only: Cardrush searches are done by
 * MarketPricesService (shared with raw cards). Sealed products aren't priced.
 */
@Injectable()
export class SlabPricesService {
  constructor(private prisma: PrismaService, private settings: SettingsService) {}

  /** Market price for in-stock graded slabs (all, or just the ids given). */
  async forSlabs(ids?: string[]) {
    const slabs = await this.prisma.slabCard.findMany({
      where: { kind: 'SLAB', quantity: { gt: 0 }, ...(ids ? { id: { in: ids } } : {}) },
      select: { id: true, cardNumber: true, gradingCompany: true, grade: true, sellPrice: true, marketListingKey: true },
    });
    const keys = slabs.map((s) => s.marketListingKey).filter((k): k is string => !!k?.startsWith(CARDRUSH_PREFIX));
    const linked = keys.length
      ? await this.prisma.marketPrice.findMany({ where: { listingKey: { in: keys } }, select: { cardNumber: true } })
      : [];
    const nums = [...new Set(linked.map((l) => l.cardNumber))];
    const [rows, all] = await Promise.all([
      nums.length ? this.prisma.marketPrice.findMany({ where: { source: SOURCE_CARDRUSH, cardNumber: { in: nums } } }) : Promise.resolve([]),
      this.settings.getAll(),
    ]);
    const copies = gradedCopies(rows);
    const byKey = new Map(copies.map((c) => [c.row.listingKey, c]));
    const rate = positive(all.jpyToPhpRate);

    const out: Record<string, {
      linkState: SlabLinkState; gradeLabel: string | null;
      priceJpy: number | null; lastSoldJpy: number | null; lowestListedJpy: number | null; basis: 'sold' | 'listed' | null; copies: number;
      marketPhp: number | null; diffPct: number | null; rate: number | null;
      listing: { listingKey: string; name: string; url: string; fetchedAt: Date } | null;
    }> = {};
    for (const s of slabs) {
      const key = s.marketListingKey;
      const copy = key ? byKey.get(key) : undefined;
      // A copy whose grade no longer matches (slab edited) counts as missing.
      const ok = !!copy && sameGrade(copy, s);
      const price = ok ? groupPrice(sameGroup(copy!, copies)) : { priceJpy: null, lastSoldJpy: null, lowestListedJpy: null, basis: null, copies: 0 };
      const marketPhp = price.priceJpy !== null && rate ? Math.round(price.priceJpy * rate) : null;
      const posted = Number(s.sellPrice);
      out[s.id] = {
        linkState: key === NO_MATCH ? 'none' : !key ? 'new' : ok ? 'linked' : 'missing',
        gradeLabel: s.gradingCompany && gradeText(s.grade) ? `${s.gradingCompany.toUpperCase()} ${gradeText(s.grade)}` : null,
        ...price, marketPhp, rate,
        diffPct: marketPhp ? Math.round(((posted - marketPhp) / marketPhp) * 1000) / 10 : null,
        listing: ok ? { listingKey: copy!.row.listingKey, name: copy!.row.name, url: copy!.row.url, fetchedAt: copy!.row.fetchedAt } : null,
      };
    }
    return out;
  }

  /** Graded Cardrush copies of a card number for the slab link picker, flagged when the grade matches. */
  async copiesFor(slab: SlabForLink, cardNumber: string) {
    const rows = await this.prisma.marketPrice.findMany({ where: { source: SOURCE_CARDRUSH, cardNumber: norm(cardNumber) } });
    const copies = gradedCopies(rows);
    return copies
      .map((c) => ({
        listingKey: c.row.listingKey, name: c.row.name, priceJpy: c.row.priceJpy, inStock: c.row.inStock,
        stockCount: c.row.stockCount, url: c.row.url, company: c.company, grade: c.grade,
        sameGrade: sameGrade(c, slab),
        group: groupPrice(sameGroup(c, copies)),
      }))
      .sort((a, b) => Number(b.sameGrade) - Number(a.sameGrade) || a.name.localeCompare(b.name) || b.priceJpy - a.priceJpy);
  }

  /** Link a slab to a Cardrush graded copy, or "none" for no market price. */
  async link(slabId: string, key: string) {
    const slab = await this.findSlab(slabId);
    if (key !== NO_MATCH) {
      const row = await this.prisma.marketPrice.findUnique({ where: { listingKey: key } });
      const copy = row ? gradedCopies([row])[0] : undefined;
      if (!copy) throw new BadRequestException('That Cardrush product isn\'t a graded copy (〔PSA10鑑定済〕…).');
      if (!sameGrade(copy, slab)) {
        throw new BadRequestException(`That copy is ${copy.company} ${copy.grade}, but this slab is ${slab.gradingCompany ?? '?'} ${gradeText(slab.grade) ?? '?'}.`);
      }
    }
    await this.prisma.slabCard.update({ where: { id: slabId }, data: { marketListingKey: key } });
    return { id: slabId, marketListingKey: key };
  }

  /** In-stock graded slabs never linked (Link new stock). */
  unlinkedSlabs() {
    return this.prisma.slabCard.findMany({
      where: { kind: 'SLAB', quantity: { gt: 0 }, marketListingKey: null },
      select: { id: true, cardNumber: true, rarity: true, gradingCompany: true, grade: true },
    });
  }

  /** Card numbers whose Cardrush listings linked slabs depend on (Sync). */
  async linkedSlabNumbers(): Promise<string[]> {
    const slabs = await this.prisma.slabCard.findMany({
      where: { kind: 'SLAB', quantity: { gt: 0 }, marketListingKey: { startsWith: CARDRUSH_PREFIX } },
      select: { cardNumber: true, marketListingKey: true },
    });
    if (!slabs.length) return [];
    const rows = await this.prisma.marketPrice.findMany({
      where: { listingKey: { in: slabs.map((s) => s.marketListingKey!) } }, select: { listingKey: true, cardNumber: true },
    });
    const byKey = new Map(rows.map((r) => [r.listingKey, r.cardNumber]));
    return [...new Set(slabs.map((s) => byKey.get(s.marketListingKey!) ?? (s.cardNumber ? norm(s.cardNumber) : null))
      .filter((n): n is string => !!n))];
  }

  /** Link each slab whose exact card, version, company and grade is unambiguous on Cardrush. */
  async autoLink(slabs: SlabForLink[]) {
    const nums = [...new Set(slabs.map((s) => s.cardNumber?.trim().toUpperCase()).filter((n): n is string => !!n))];
    const rows = nums.length
      ? await this.prisma.marketPrice.findMany({ where: { source: SOURCE_CARDRUSH, cardNumber: { in: nums } } })
      : [];
    const copies = gradedCopies(rows);
    const found = new Map<string, string>();
    for (const s of slabs) {
      const pick: GradedCopy | null = pickSlabCopy(s, copies);
      if (pick) found.set(s.id, pick.row.listingKey);
    }
    if (found.size) {
      await this.prisma.$transaction([...found].map(([id, key]) =>
        this.prisma.slabCard.update({ where: { id }, data: { marketListingKey: key } })));
    }
    return { linked: found.size, unmatched: slabs.length - found.size, keys: found };
  }

  async findSlab(slabId: string) {
    const slab = await this.prisma.slabCard.findUnique({
      where: { id: slabId }, select: { id: true, kind: true, cardNumber: true, rarity: true, gradingCompany: true, grade: true },
    });
    if (!slab) throw new NotFoundException('Slab not found');
    if (slab.kind !== 'SLAB') throw new BadRequestException('Only graded slabs have a market price');
    return slab;
  }
}
