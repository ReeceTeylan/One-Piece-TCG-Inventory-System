import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { TopQueryDto, TrendQueryDto } from './dto/analytics-query.dto';

const num = (v: any) => (v === null || v === undefined ? 0 : Number(v));
const ACTIVE = { notIn: ['CANCELLED', 'REFUNDED'] as any };

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService, private settings: SettingsService) {}

  private periodStart(range: 'today' | 'week' | 'month' | 'year'): Date {
    const d = new Date();
    if (range === 'today') d.setHours(0, 0, 0, 0);
    else if (range === 'week') d.setDate(d.getDate() - 7);
    else if (range === 'month') d.setMonth(d.getMonth() - 1);
    else d.setFullYear(d.getFullYear() - 1);
    return d;
  }

  /** Revenue + profit + order count for a rolling range. */
  private async totalsSince(start: Date, end?: Date) {
    const createdAt: Prisma.DateTimeFilter = { gte: start };
    if (end) createdAt.lt = end;
    const agg = await this.prisma.sale.aggregate({
      where: { status: ACTIVE, createdAt },
      _sum: { grandTotal: true, totalProfit: true },
      _count: { _all: true },
    });
    const cardsSold = await this.prisma.saleItem.aggregate({
      _sum: { quantity: true },
      where: { sale: { status: ACTIVE, createdAt } },
    });
    return {
      revenue: num(agg._sum.grandTotal),
      profit: num(agg._sum.totalProfit),
      orders: agg._count._all,
      cardsSold: num(cardsSold._sum.quantity),
    };
  }

  private static growth(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Number((((current - previous) / previous) * 100).toFixed(1));
  }

  /** Full dashboard payload. */
  async dashboard() {
    const now = new Date();
    // Lifetime daily-profit average, counted from the day the store opened (PH time via TZ).
    const OPERATION_START = new Date(2026, 6, 11); // July 11, 2026 (month is 0-based)
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysOperating = Math.max(1, Math.floor((now.getTime() - OPERATION_START.getTime()) / msPerDay) + 1);
    const startToday = this.periodStart('today');
    const startWeek = this.periodStart('week');
    const startMonth = this.periodStart('month');
    const startYear = this.periodStart('year');

    // previous comparable windows for growth
    const prevWeekStart = new Date(startWeek); prevWeekStart.setDate(prevWeekStart.getDate() - 7);
    const prevMonthStart = new Date(startMonth); prevMonthStart.setMonth(prevMonthStart.getMonth() - 1);

    const [today, week, month, year, prevWeek, prevMonth] = await Promise.all([
      this.totalsSince(startToday),
      this.totalsSince(startWeek),
      this.totalsSince(startMonth),
      this.totalsSince(startYear),
      this.totalsSince(prevWeekStart, startWeek),
      this.totalsSince(prevMonthStart, startMonth),
    ]);

    const inventory = await this.inventory();
    const [totalRaw, totalSlabs, waitingToShip] = await Promise.all([
      this.prisma.rawCard.aggregate({ _sum: { quantity: true } }),
      this.prisma.slabCard.count({ where: { status: { not: 'SOLD' } } }),
      this.prisma.shipment.count({ where: { status: { in: ['TO_PACK', 'READY'] } } }),
    ]);

    return {
      revenue: { today: today.revenue, week: week.revenue, month: month.revenue, year: year.revenue },
      profit: { today: today.profit, week: week.profit, month: month.profit, year: year.profit },
      avgDailyProfit: Math.round(year.profit / daysOperating),
      cardsSold: { today: today.cardsSold, week: week.cardsSold, month: month.cardsSold, year: year.cardsSold },
      orders: { today: today.orders, week: week.orders, month: month.orders, year: year.orders },
      growth: {
        revenueWeek: AnalyticsService.growth(week.revenue, prevWeek.revenue),
        revenueMonth: AnalyticsService.growth(month.revenue, prevMonth.revenue),
        profitMonth: AnalyticsService.growth(month.profit, prevMonth.profit),
      },
      inventory,
      counts: {
        totalRawCards: num(totalRaw._sum.quantity),
        totalSlabs,
        waitingToShip,
      },
      generatedAt: now.toISOString(),
    };
  }

  /** Inventory value & averages & stock health. */
  /** Inventory value & averages & stock health. */
  async inventory() {
    const [rawValue] = await this.prisma.$queryRaw<{ totalSpent: any; totalPosted: any; avgcost: any; avgprice: any }[]>(
      Prisma.sql`SELECT
        COALESCE(SUM(quantity * "buyCost"),0)      AS "totalSpent",
        COALESCE(SUM(quantity * "postedPrice"),0)  AS "totalPosted",
        COALESCE(AVG("buyCost"),0)                 AS avgcost,
        COALESCE(AVG("postedPrice"),0)             AS avgprice
      FROM raw_cards`,
    );

    const [slabValue] = await this.prisma.$queryRaw<{ totalSpent: any; totalPosted: any }[]>(
      Prisma.sql`SELECT 
        COALESCE(SUM("buyCost"),0) AS "totalSpent",
        COALESCE(SUM("sellPrice"),0) AS "totalPosted"
      FROM slab_cards WHERE status <> 'SOLD'`,
    );

    const margin = await this.prisma.sale.aggregate({
      where: { status: { notIn: ['CANCELLED', 'REFUNDED'] } }, 
      _sum: { grandTotal: true, totalProfit: true },
    });

    const rev = num(margin._sum.grandTotal);
    const prof = num(margin._sum.totalProfit);

    const totalSpent = num(rawValue.totalSpent) + num(slabValue.totalSpent);
    const totalPosted = num(rawValue.totalPosted) + num(slabValue.totalPosted);
    
    // Inventory value is now 80% of the total posted price
    const inventoryValue = totalPosted * 0.8;

    return {
      inventoryValue: inventoryValue,
      averageBuyingCost: Number(num(rawValue.avgcost).toFixed(2)),
      averageSellingPrice: Number(num(rawValue.avgprice).toFixed(2)),
      profitMargin: rev > 0 ? Number(((prof / rev) * 100).toFixed(1)) : 0,
      totalPostedPrice: totalPosted,
      totalSpent: totalSpent,
    };
  }

  private async deadStockCount(): Promise<number> {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
    return this.prisma.rawCard.count({
      where: {
        quantity: { gt: 0 },
        OR: [{ totalSold: 0 }, { lastSoldAt: { lt: cutoff } }, { lastSoldAt: null }],
      },
    });
  }

  /** Time-bucketed trend series for the line charts. */
  async trends(query: TrendQueryDto & { targetMonth?: string }) {
    const unit = query.granularity === 'yearly' ? 'year' : query.granularity === 'monthly' ? 'month' : 'day';

    let salesDateFilter = Prisma.empty;
    let itemsDateFilter = Prisma.empty;
    
    if (query.targetMonth) {
      const [year, month] = query.targetMonth.split('-');
      const startDate = new Date(Number(year), Number(month) - 1, 1);
      const endDate = new Date(Number(year), Number(month), 1); 

      salesDateFilter = Prisma.sql`AND "createdAt" >= ${startDate} AND "createdAt" < ${endDate}`;
      itemsDateFilter = Prisma.sql`AND s."createdAt" >= ${startDate} AND s."createdAt" < ${endDate}`;
    }

    const rows = await this.prisma.$queryRaw<
      { bucket: Date; revenue: any; profit: any; orders: any; cards: any }[]
    >(Prisma.sql`
      WITH daily_sales AS (
        SELECT 
          date_trunc(${unit}, "createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila') AS bucket,
          SUM("grandTotal") AS revenue,
          SUM("totalProfit") AS profit,
          COUNT(id) AS orders
        FROM sales
        WHERE status NOT IN ('CANCELLED','REFUNDED') ${salesDateFilter}
        GROUP BY 1
      ),
      daily_items AS (
        SELECT 
          date_trunc(${unit}, s."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila') AS bucket,
          SUM(si.quantity) AS cards
        FROM sales s
        LEFT JOIN sale_items si ON si."saleId" = s.id
        WHERE s.status NOT IN ('CANCELLED','REFUNDED') ${itemsDateFilter}
        GROUP BY 1
      )
      SELECT 
        s.bucket,
        COALESCE(s.revenue, 0) AS revenue,
        COALESCE(s.profit, 0) AS profit,
        COALESCE(s.orders, 0) AS orders,
        COALESCE(i.cards, 0) AS cards
      FROM daily_sales s
      LEFT JOIN daily_items i ON s.bucket = i.bucket
      ORDER BY s.bucket DESC
      LIMIT ${query.targetMonth ? 31 : query.points}
    `);

    return rows
      .map((r) => ({
        date: r.bucket,
        revenue: num(r.revenue),
        profit: num(r.profit),
        orders: num(r.orders),
        cardsSold: num(r.cards),
      }))
      .reverse();
  }

  /** Best sellers, most valuable, highest profit, top rarities, fastest/slowest. */
  async cards(query: TopQueryDto) {
    const limit = query.limit;
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);

    const [bestSellers, mostValuable, fastest, slowest, deadStock, lowStock] = await Promise.all([
      this.prisma.rawCard.findMany({ where: { totalSold: { gt: 0 } }, orderBy: { totalSold: 'desc' }, take: limit }),
      this.prisma.rawCard.findMany({ orderBy: [{ postedPrice: 'desc' }], take: limit }),
      this.prisma.rawCard.findMany({ where: { totalSold: { gt: 0 } }, orderBy: { totalSold: 'desc' }, take: limit }),
      this.prisma.rawCard.findMany({ where: { quantity: { gt: 0 } }, orderBy: { totalSold: 'asc' }, take: limit }),
      this.prisma.rawCard.findMany({
        where: { quantity: { gt: 0 }, OR: [{ totalSold: 0 }, { lastSoldAt: { lt: cutoff } }, { lastSoldAt: null }] },
        take: limit,
      }),
      this.prisma.rawCard.findMany({ where: { quantity: { gt: 0 }, status: 'LOW' }, orderBy: { quantity: 'asc' }, take: limit }),
    ]);

    // highest profit — aggregate realised profit per raw card from sale_items
    const highestProfit = await this.prisma.$queryRaw<{ rawcardid: string; name: string; profit: any; sold: any }[]>(
      Prisma.sql`
        SELECT si."rawCardId" AS rawcardid, si."nameSnapshot" AS name,
               SUM(si."lineProfit") AS profit, SUM(si.quantity) AS sold
        FROM sale_items si
        JOIN sales s ON s.id = si."saleId"
        WHERE si."itemType" = 'RAW' AND s.status NOT IN ('CANCELLED','REFUNDED')
        GROUP BY si."rawCardId", si."nameSnapshot"
        ORDER BY profit DESC
        LIMIT ${limit}`,
    );

    // top selling rarities
    const topRarities = await this.prisma.$queryRaw<{ rarity: string; sold: any; revenue: any }[]>(
      Prisma.sql`
        SELECT rc.rarity AS rarity, SUM(si.quantity) AS sold,
               SUM(si."unitPrice" * si.quantity) AS revenue
        FROM sale_items si
        JOIN raw_cards rc ON rc.id = si."rawCardId"
        JOIN sales s ON s.id = si."saleId"
        WHERE s.status NOT IN ('CANCELLED','REFUNDED')
        GROUP BY rc.rarity
        ORDER BY sold DESC
        LIMIT ${limit}`,
    );

    return {
      bestSellers,
      mostValuable,
      fastestSelling: fastest,
      slowestSelling: slowest,
      deadStock,
      lowStock,
      highestProfit: highestProfit.map((r) => ({ ...r, profit: num(r.profit), sold: num(r.sold) })),
      topRarities: topRarities.map((r) => ({ rarity: r.rarity, sold: num(r.sold), revenue: num(r.revenue) })),
    };
  }

  /** Slab-specific analytics. */
  async slabs() {
    const [available, sold] = await this.prisma.$transaction([
      this.prisma.slabCard.count({ where: { status: { not: 'SOLD' } } }),
      this.prisma.slabCard.findMany({ where: { status: 'SOLD' } }),
    ]);
    const soldRevenue = sold.reduce((a, s) => a + num(s.sellPrice), 0);
    const soldProfit = sold.reduce((a, s) => a + (num(s.sellPrice) - num(s.buyCost)), 0);
    const avgGrade = sold.length ? sold.reduce((a, s) => a + num(s.grade), 0) / sold.length : 0;
    const highestProfit = [...sold].sort((a, b) =>
      (num(b.sellPrice) - num(b.buyCost)) - (num(a.sellPrice) - num(a.buyCost)))[0] ?? null;
    return {
      totalAvailable: available,
      slabsSold: sold.length,
      slabRevenue: soldRevenue,
      slabProfit: soldProfit,
      averageGradeSold: Number(avgGrade.toFixed(1)),
      highestProfitSlab: highestProfit,
    };
  }

  /** Top customers by lifetime spend. */
  async customers(query: TopQueryDto) {
    const rows = await this.prisma.$queryRaw<
      { id: string; name: string; orders: any; spent: any; profit: any }[]
    >(Prisma.sql`
      SELECT c.id, c.name, COUNT(s.id) AS orders,
             COALESCE(SUM(s."grandTotal"),0) AS spent,
             COALESCE(SUM(s."totalProfit"),0) AS profit
      FROM customers c
      JOIN sales s ON s."customerId" = c.id AND s.status NOT IN ('CANCELLED','REFUNDED')
      GROUP BY c.id, c.name
      ORDER BY spent DESC
      LIMIT ${query.limit}
    `);
    return rows.map((r) => ({ id: r.id, name: r.name, orders: num(r.orders), spent: num(r.spent), profit: num(r.profit) }));
  }
}
