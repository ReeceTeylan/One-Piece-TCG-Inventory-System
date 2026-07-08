import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

const DEFAULTS = {
  storeName: 'OP-Vault TCG',
  logoUrl: null as string | null,
  currency: 'PHP',
  defaultShippingFee: 80,
  lowStockThreshold: 3,
  postedPriceFormula: 'cost * 2.4',
};

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService, private audit: ActivityLogsService) {}

  /** Return all settings as a flat object, backfilling defaults for missing keys. */
  async getAll(): Promise<Record<string, any>> {
    const rows = await this.prisma.setting.findMany();
    const map: Record<string, any> = { ...DEFAULTS };
    for (const r of rows) map[r.key] = r.value;
    return map;
  }

  /** Read a single setting, falling back to its default. */
  async get<T = any>(key: keyof typeof DEFAULTS): Promise<T> {
    const row = await this.prisma.setting.findUnique({ where: { key } });
    return (row ? row.value : (DEFAULTS as any)[key]) as T;
  }

  async update(dto: UpdateSettingsDto, userId: string) {
    const entries = Object.entries(dto).filter(([, v]) => v !== undefined);
    await this.prisma.$transaction(
      entries.map(([key, value]) =>
        this.prisma.setting.upsert({
          where: { key },
          update: { value: value as Prisma.InputJsonValue },
          create: { key, value: value as Prisma.InputJsonValue },
        }),
      ),
    );
    await this.audit.log({ userId, action: 'settings.update', entityType: 'Setting', metadata: dto as any });
    return this.getAll();
  }
}
