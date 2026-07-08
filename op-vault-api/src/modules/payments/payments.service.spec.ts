import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = { $transaction: jest.fn((cb) => cb(prisma)), sale: {}, payment: {} };
    const moduleRef = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ActivityLogsService, useValue: { log: jest.fn() } },
      ],
    }).compile();
    service = moduleRef.get(PaymentsService);
  });

  describe('deriveStatus', () => {
    it('returns UNPAID when nothing paid', () => {
      expect(PaymentsService.deriveStatus(0, 1000)).toBe('UNPAID');
    });
    it('returns PARTIAL when some paid', () => {
      expect(PaymentsService.deriveStatus(400, 1000)).toBe('PARTIAL');
    });
    it('returns PAID when fully paid', () => {
      expect(PaymentsService.deriveStatus(1000, 1000)).toBe('PAID');
    });
  });

  it('rejects overpayment', async () => {
    prisma.sale.findUnique = jest.fn().mockResolvedValue({
      id: 's1', grandTotal: 1000, amountPaid: 900, status: 'PARTIAL',
    });
    prisma.payment.create = jest.fn();
    prisma.sale.update = jest.fn();
    await expect(
      service.addPayment('s1', { amount: 200, method: 'CASH' } as any, 'u1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('records a payment and marks PAID when balance cleared', async () => {
    prisma.sale.findUnique = jest.fn().mockResolvedValue({
      id: 's1', grandTotal: 1000, amountPaid: 600, status: 'PARTIAL',
    });
    prisma.payment.create = jest.fn().mockResolvedValue({});
    prisma.sale.update = jest.fn().mockResolvedValue({ status: 'PAID' });
    const res = await service.addPayment('s1', { amount: 400, method: 'GCASH' } as any, 'u1');
    expect(res.status).toBe('PAID');
    expect(res.remainingBalance).toBe(0);
    expect(prisma.payment.create).toHaveBeenCalled();
  });
});
