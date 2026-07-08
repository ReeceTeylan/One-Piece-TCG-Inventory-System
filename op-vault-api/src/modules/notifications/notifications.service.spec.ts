import { Test } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = { notification: { create: jest.fn().mockResolvedValue({ id: 'n1' }) } };
    const moduleRef = await Test.createTestingModule({
      providers: [NotificationsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(NotificationsService);
  });

  it('emits a low-stock notification at/below threshold', async () => {
    await service.emitLowStock({ id: 'r1', name: 'Zoro', quantity: 2 }, 3);
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'LOW_STOCK' }) }),
    );
  });

  it('emits OUT_OF_STOCK at zero', async () => {
    await service.emitLowStock({ id: 'r1', name: 'Sanji', quantity: 0 }, 3);
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'OUT_OF_STOCK' }) }),
    );
  });

  it('does not emit above threshold', async () => {
    const res = await service.emitLowStock({ id: 'r1', name: 'Nami', quantity: 20 }, 3);
    expect(res).toBeNull();
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });
});
