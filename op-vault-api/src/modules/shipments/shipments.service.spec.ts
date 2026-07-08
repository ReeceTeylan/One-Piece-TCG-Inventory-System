import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ShipmentsService } from './shipments.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { NotificationsService } from '../notifications/notifications.service';

describe('ShipmentsService', () => {
  let service: ShipmentsService;
  let prisma: any;
  let tx: any;

  beforeEach(async () => {
    tx = {
      shipment: { update: jest.fn().mockResolvedValue({ id: 'sh1' }) },
      shipmentEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    prisma = {
      shipment: { findUnique: jest.fn() },
      shipmentEvent: { findMany: jest.fn() },
      $transaction: jest.fn((cb: any) => cb(tx)),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        ShipmentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ActivityLogsService, useValue: { log: jest.fn() } },
        { provide: NotificationsService, useValue: { emit: jest.fn() } },
      ],
    }).compile();
    service = moduleRef.get(ShipmentsService);
  });

  it('rejects an invalid status transition', async () => {
    prisma.shipment.findUnique.mockResolvedValue({ id: 'sh1', status: 'TO_PACK', sale: { customer: {} } });
    await expect(service.update('sh1', { status: 'DELIVERED' } as any, 'u1')).rejects.toThrow(BadRequestException);
  });

  it('allows a valid transition and writes a timeline event', async () => {
    prisma.shipment.findUnique.mockResolvedValue({ id: 'sh1', status: 'TO_PACK', sale: { customer: { name: 'Juan' }, reference: 'SALE-1' } });
    await service.update('sh1', { status: 'READY' } as any, 'u1');
    expect(tx.shipmentEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'READY' }) }),
    );
  });
});
