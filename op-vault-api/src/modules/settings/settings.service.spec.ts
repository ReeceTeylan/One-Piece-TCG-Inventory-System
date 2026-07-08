import { Test } from '@nestjs/testing';
import { SettingsService } from './settings.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';

describe('SettingsService', () => {
  let service: SettingsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      setting: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn(), upsert: jest.fn() },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ActivityLogsService, useValue: { log: jest.fn() } },
      ],
    }).compile();
    service = moduleRef.get(SettingsService);
  });

  it('backfills defaults when no rows exist', async () => {
    const s = await service.getAll();
    expect(s.currency).toBe('PHP');
    expect(s.lowStockThreshold).toBe(3);
  });

  it('overrides defaults with stored values', async () => {
    prisma.setting.findMany.mockResolvedValue([{ key: 'currency', value: 'USD' }]);
    const s = await service.getAll();
    expect(s.currency).toBe('USD');
  });

  it('returns a single setting default via get()', async () => {
    prisma.setting.findUnique.mockResolvedValue(null);
    expect(await service.get('lowStockThreshold')).toBe(3);
  });
});
