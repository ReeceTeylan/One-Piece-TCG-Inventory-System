import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { SalesService } from './sales.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';

/** Build a mock Prisma transaction client. */
function makeTx(overrides: any = {}) {
  return {
    customer: { findUnique: jest.fn().mockResolvedValue({ id: 'c1' }), create: jest.fn() },
    rawCard: { findUnique: jest.fn(), update: jest.fn().mockResolvedValue({}) },
    slabCard: { findUnique: jest.fn(), update: jest.fn().mockResolvedValue({}) },
    inventoryLog: { create: jest.fn().mockResolvedValue({}) },
    priceHistory: { create: jest.fn().mockResolvedValue({}) },
    payment: { create: jest.fn().mockResolvedValue({}) },
    notification: { create: jest.fn().mockResolvedValue({}) },
    shipmentEvent: { create: jest.fn().mockResolvedValue({}) },
    shipment: { create: jest.fn().mockResolvedValue({ id: 'ship1' }) },
    sale: {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({ id: 'sale1' }),
      findUnique: jest.fn().mockResolvedValue({ id: 'sale1', items: [] }),
    },
    ...overrides,
  };
}

describe('SalesService.completeSale', () => {
  let service: SalesService;
  let tx: any;

  async function build(txClient: any) {
    tx = txClient;
    const prisma = { $transaction: jest.fn((cb: any) => cb(tx)) };
    const moduleRef = await Test.createTestingModule({
      providers: [
        SalesService,
        { provide: PrismaService, useValue: prisma },
        { provide: ActivityLogsService, useValue: { log: jest.fn() } },
      ],
    }).compile();
    service = moduleRef.get(SalesService);
  }

  it('computes totals & profit and deducts stock (happy path)', async () => {
    const t = makeTx();
    t.rawCard.findUnique.mockResolvedValue({
      id: 'r1', name: 'Luffy', quantity: 10, buyCost: 40, postedPrice: 100, totalSold: 0, avgSellPrice: 0,
    });
    await build(t);

    await service.completeSale(
      {
        customerId: 'c1', courier: 'JNT', discount: 0, shippingFee: 50,
        amountPaid: 0, paymentMethod: 'CASH',
        items: [{ itemType: 'RAW', rawCardId: 'r1', quantity: 2, unitPrice: 100 }],
      } as any,
      'u1',
    );

    // stock deducted 10 -> 8
    expect(t.rawCard.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'r1' }, data: expect.objectContaining({ quantity: 8 }) }),
    );
    // sale created with grandTotal 250 (200 + 50 shipping) and profit 120
    const saleArg = t.sale.create.mock.calls[0][0].data;
    expect(Number(saleArg.grandTotal)).toBe(250);
    expect(Number(saleArg.totalProfit)).toBe(120);
    // shipment + opening event created
    expect(t.shipment.create).toHaveBeenCalled();
    expect(t.shipmentEvent.create).toHaveBeenCalled();
  });

  it('rolls back (throws, no sale created) on insufficient stock', async () => {
    const t = makeTx();
    t.rawCard.findUnique.mockResolvedValue({
      id: 'r1', name: 'Luffy', quantity: 1, buyCost: 40, postedPrice: 100, totalSold: 0, avgSellPrice: 0,
    });
    await build(t);

    await expect(
      service.completeSale(
        { customerId: 'c1', courier: 'JNT', items: [{ itemType: 'RAW', rawCardId: 'r1', quantity: 5, unitPrice: 100 }] } as any,
        'u1',
      ),
    ).rejects.toThrow(BadRequestException);
    expect(t.sale.create).not.toHaveBeenCalled();
  });

  it('rejects selling an already-sold slab', async () => {
    const t = makeTx();
    t.slabCard.findUnique.mockResolvedValue({ id: 's1', name: 'Shanks', gradingCompany: 'PSA', grade: 10, buyCost: 5000, status: 'SOLD' });
    await build(t);
    await expect(
      service.completeSale(
        { customerId: 'c1', courier: 'LBC', items: [{ itemType: 'SLAB', slabId: 's1', quantity: 1, unitPrice: 9000 }] } as any,
        'u1',
      ),
    ).rejects.toThrow(BadRequestException);
    expect(t.sale.create).not.toHaveBeenCalled();
  });
});
