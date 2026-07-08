import { Test } from '@nestjs/testing';
import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;

  beforeEach(async () => {
    const prisma = {
      sale: { aggregate: jest.fn().mockResolvedValue({ _sum: { grandTotal: 0, totalProfit: 0 }, _count: { _all: 0 } }) },
      saleItem: { aggregate: jest.fn().mockResolvedValue({ _sum: { quantity: 0 } }) },
      rawCard: { aggregate: jest.fn().mockResolvedValue({ _sum: { quantity: 0 } }), count: jest.fn().mockResolvedValue(0) },
      slabCard: { count: jest.fn().mockResolvedValue(0) },
      shipment: { count: jest.fn().mockResolvedValue(0) },
      $queryRaw: jest.fn().mockResolvedValue([{ value: 0, avgcost: 0, avgprice: 0 }]),
      $transaction: jest.fn((arr: any) => Promise.all(arr)),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: PrismaService, useValue: prisma },
        { provide: SettingsService, useValue: { get: jest.fn().mockResolvedValue(3) } },
      ],
    }).compile();
    service = moduleRef.get(AnalyticsService);
  });

  it('computes growth percentages correctly', () => {
    expect((AnalyticsService as any).growth(150, 100)).toBe(50);
    expect((AnalyticsService as any).growth(50, 100)).toBe(-50);
    expect((AnalyticsService as any).growth(10, 0)).toBe(100);
    expect((AnalyticsService as any).growth(0, 0)).toBe(0);
  });

  it('returns a well-formed dashboard payload', async () => {
    const d = await service.dashboard();
    expect(d).toHaveProperty('revenue.today');
    expect(d).toHaveProperty('growth.revenueWeek');
    expect(d).toHaveProperty('inventory.inventoryValue');
    expect(d).toHaveProperty('counts.totalSlabs');
  });
});
