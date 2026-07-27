import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PromosService {
  constructor(private prisma: PrismaService) {}

  /** The promo currently in effect, or null. Self-expires via endsAt — no cron needed. */
  async getActive() {
    const now = new Date();
    return this.prisma.promo.findFirst({
      where: { startsAt: { lte: now }, endsAt: { gt: now }, endedAt: null },
      orderBy: { startsAt: 'desc' },
    });
  }

  /** Starts a promo. Any promo still running is ended first. */
  async create(percentage: number, durationHours: number, note?: string) {
    const now = new Date();
    const endsAt = new Date(now.getTime() + durationHours * 60 * 60 * 1000);

    return this.prisma.$transaction(async (tx) => {
      await tx.promo.updateMany({
        where: { endsAt: { gt: now }, endedAt: null },
        data: { endedAt: now },
      });
      return tx.promo.create({
        data: {
          percentage: new Prisma.Decimal(percentage.toFixed(2)),
          startsAt: now,
          endsAt,
          note: note ?? null,
        },
      });
    });
  }

  /** Ends the running promo immediately. */
  async endNow() {
    const active = await this.getActive();
    if (!active) throw new NotFoundException('No promo is currently running');
    return this.prisma.promo.update({
      where: { id: active.id },
      data: { endedAt: new Date() },
    });
  }

  /** Recent promos, newest first — for a small history list. */
  async history(limit = 10) {
    return this.prisma.promo.findMany({ orderBy: { startsAt: 'desc' }, take: limit });
  }
}