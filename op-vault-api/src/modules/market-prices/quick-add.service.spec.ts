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


describe('QuickAddService selected sold-out restock', () => {
  const requestId = 'ee379c39-00bf-44e4-9868-35708808665a';
  const id = 'old-raw-123';
  const dto: any = {
    existingCardId: id, requestId, cardNumber: 'OP09-119',
    source: 'YUYUTEI', listingKey: `existing:${id}`,
    quantity: 2, buyCost: 200, postedPrice: 600, notes: 'Mint',
  };
  it('only lists exact card-number records that have no remaining stock', async () => {
    const prisma: any = { rawCard: { findMany: jest.fn().mockResolvedValue([
      { id, cardNumber: 'OP09-119', name: 'Luffy', quantity: 0, buyCost: 100, postedPrice: 500, images: [{url:'https://example.com/old.jpg'}] },
    ]) } };
    const svc = new QuickAddService(prisma, {} as any, {} as any);
    const rows = await svc.soldOutListings('op09-119');
    expect(prisma.rawCard.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { cardNumber: { equals: 'OP09-119', mode: 'insensitive' }, quantity: 0 },
    }));
    expect(rows[0].imageUrl).toBe('https://example.com/old.jpg');
  });
  it('replays a completed selected-restock receipt without incrementing stock again', async () => {
    const prisma: any = {
      quickAddReceipt: { findUnique: jest.fn().mockResolvedValue({
        userId: 'owner', listingKey: `existing:${id}`, cardId: id, action: 'reactivated',
      }) },
      rawCard: { findUnique: jest.fn().mockResolvedValue({ id, cardNumber: 'OP09-119', quantity: 2 }) },
      cardImage: { findFirst: jest.fn().mockResolvedValue({ id: 'old-image' }) },
      $transaction: jest.fn(),
    };
    const svc = new QuickAddService(prisma, {} as any, {} as any);
    const result = await svc.add(dto, 'owner');
    expect(result.hasImage).toBe(true);
    expect(result.action).toBe('reactivated');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('restocks the selected card only and keeps its image and source link intact', async () => {
    const existing = {
      id, cardNumber: 'OP09-119', quantity: 0, buyCost: 100,
      postedPrice: 500, notes: '', marketListingKey: 'duplicate-source-link',
    };
    const tx: any = {
      quickAddReceipt: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn() },
      rawCard: { findUnique: jest.fn().mockResolvedValue(existing),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ ...existing, quantity: 2 }) },
      cardImage: { findFirst: jest.fn().mockResolvedValue({id:'old-image'}) },
      priceHistory: { create: jest.fn() },
      restockLog: { create: jest.fn() },
      inventoryLog: { create: jest.fn() },
    };
    const prisma: any = { quickAddReceipt: {findUnique: jest.fn().mockResolvedValue(null)},
      $transaction: jest.fn().mockImplementation((fn: any) => fn(tx)) };
    const svc = new QuickAddService(prisma, {} as any, {} as any);
    const result = await svc.add(dto, 'owner');
    expect(result.action).toBe('reactivated');
    const update = tx.rawCard.updateMany.mock.calls[0][0];
    expect(update.where).toEqual({ id, quantity: 0 });
    expect(update.data.quantity).toBe(2);
    expect(update.data.marketListingKey).toBeUndefined();
    expect(update.data.images).toBeUndefined();
    expect(tx.inventoryLog.create).toHaveBeenCalledTimes(1);
  });
});
