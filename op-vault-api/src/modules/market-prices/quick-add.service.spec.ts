import { QuickAddService } from './quick-add.service';
import { ConflictException } from '@nestjs/common';

describe('QuickAddService replay safety', () => {
  const requestId = '712c4af6-bddd-4f11-82c5-9c6f9f749192';
  const card = { id: 'card1', cardNumber: 'OP01-120', quantity: 8 };
  const dto: any = {
    requestId, cardNumber: 'OP01-120', source: 'YUYUTEI', listingKey: 'y:120',
    quantity: 2, englishName: 'Monkey D. Luffy', englishCharacter: 'Monkey D. Luffy',
  };
  const make = () => {
    const prisma: any = {
      quickAddReceipt: { findUnique: jest.fn().mockResolvedValue({ id: requestId, listingKey: 'y:120', userId: 'owner1', cardId: 'card1', action: 'restocked' }) },
      rawCard: { findUnique: jest.fn().mockResolvedValue(card) },
      cardImage: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(),
    };
    const svc = new QuickAddService(prisma, {} as any, {} as any);
    const preview = jest.spyOn(svc, 'preview');
    return { svc, prisma, preview };
  };

  it('returns a prior result without fetching marketplace quotes or mutating stock', async () => {
    const { svc, prisma, preview } = make();
    const result = await svc.add(dto, 'owner1');
    expect(result.action).toBe('restocked');
    expect(result.card).toEqual(card);
    expect(preview).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects reusing an idempotency key for a different source listing', async () => {
    const { svc } = make();
    await expect(svc.add({ ...dto, listingKey: 'y:other' }, 'owner1')).rejects.toThrow(ConflictException);
  });
});
