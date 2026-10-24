import { RawCardsService } from './raw-cards.service';
import { ConflictException } from '@nestjs/common';

describe('RawCardsService stock compare-and-swap', () => {
  const make = (count: number) => {
    const tx: any = {
      rawCard: {
        findUnique: jest.fn().mockResolvedValue({ id: 'c1', quantity: 5, buyCost: 100 }),
        updateMany: jest.fn().mockResolvedValue({ count }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'c1', quantity: 7, buyCost: 125 }),
      },
      inventoryLog: { create: jest.fn() },
      restockLog: { create: jest.fn() },
    };
    const prisma: any = { $transaction: jest.fn().mockImplementation((cb: any) => cb(tx)) };
    const service = new RawCardsService({} as any, prisma);
    return { tx, service };
  };

  it('adds stock and writes logs only after an optimistic quantity match', async () => {
    const { tx, service } = make(1);
    await service.addQuantity('c1', 2, 200, 'owner');
    expect(tx.rawCard.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'c1', quantity: 5 },
      data: expect.objectContaining({ quantity: 7 }),
    }));
    expect(tx.inventoryLog.create).toHaveBeenCalledTimes(1);
    expect(tx.restockLog.create).toHaveBeenCalledTimes(1);
  });

  it('does not record a restock after a concurrent quantity change', async () => {
    const { tx, service } = make(0);
    await expect(service.addQuantity('c1', 2, 200, 'owner')).rejects.toThrow(ConflictException);
    expect(tx.inventoryLog.create).not.toHaveBeenCalled();
    expect(tx.restockLog.create).not.toHaveBeenCalled();
  });
});
