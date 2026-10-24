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


describe('QuickAddService optional market link for old sold-out cards', () => {
  const id = 'old-raw-123';
  const selectedKey = 'st21/27182';
  const dto: any = {
    existingCardId: id, cardNumber: 'ST21-017', source: 'YUYUTEI',
    listingKey: `existing:${id}`, marketLinkKey: selectedKey,
    quantity: 3, buyCost: 140, postedPrice: 400,
  };
  const make = (currentLink: string | null = null, claimedByOther = false) => {
    const oldCard = {
      id, name: 'Luffy', cardNumber: 'ST21-017',
      marketListingKey: currentLink, quantity: 0,
      buyCost: 160, postedPrice: 400, notes: '',
    };
    const tx: any = {
      rawCard: {
        findUnique: jest.fn().mockResolvedValue(oldCard),
        findMany: jest.fn().mockResolvedValue(claimedByOther ? [{ id: 'other-card' }] : []),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ ...oldCard, quantity: 3, marketListingKey: selectedKey }),
      },
      cardImage: { findFirst: jest.fn().mockResolvedValue({ id: 'existing-photo' }) },
      restockLog: { create: jest.fn() },
      inventoryLog: { create: jest.fn() },
      priceHistory: { create: jest.fn() },
      quickAddReceipt: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn() },
    };
    const prisma: any = {
      $transaction: jest.fn((fn: any) => fn(tx)),
    };
    const market: any = {
      listingsFor: jest.fn().mockResolvedValue([{
        source: 'YUYUTEI', cardNumber: 'ST21-017', listingKey: selectedKey,
      }]),
    };
    const svc = new QuickAddService(prisma, {} as any, market);
    return { tx, prisma, market, svc };
  };

  it('attaches the exact chosen Yuyu-tei listing atomically while preserving the old image', async () => {
    const { tx, svc, market } = make();
    const result = await svc.add(dto, 'owner');
    expect(result.action).toBe('reactivated');
    expect(result.hasImage).toBe(true);
    expect(market.listingsFor).toHaveBeenCalledWith('ST21-017', 'YUYUTEI');
    expect(tx.rawCard.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id, quantity: 0, marketListingKey: null },
      data: expect.objectContaining({ quantity: 3, marketListingKey: selectedKey }),
    }));
    expect(tx.rawCard.updateMany.mock.calls[0][0].data.images).toBeUndefined();
    expect(tx.inventoryLog.create).toHaveBeenCalledTimes(1);
  });

  it('treats a previous none sentinel as unlinked', async () => {
    const { tx, svc } = make('none');
    await svc.add(dto, 'owner');
    expect(tx.rawCard.updateMany.mock.calls[0][0].data.marketListingKey).toBe(selectedKey);
  });

  it('rejects an exact-number marketplace link already assigned to another card', async () => {
    const { tx, svc } = make(null, true);
    await expect(svc.add(dto, 'owner')).rejects.toThrow('already linked to another card');
    expect(tx.rawCard.updateMany).not.toHaveBeenCalled();
  });

  it('rejects trying to replace a link on an already linked old record', async () => {
    const { tx, svc } = make('duplicate-link-must-stay');
    await expect(svc.add(dto, 'owner')).rejects.toThrow('already has a marketplace link');
    expect(tx.rawCard.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a source or card mismatch without incrementing stock', async () => {
    const { tx, prisma, svc, market } = make();
    market.listingsFor.mockResolvedValue([{ source: 'CARDRUSH', cardNumber: 'ST21-017', listingKey: selectedKey }]);
    await expect(svc.add(dto, 'owner')).rejects.toThrow('does not match this card number and source');
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.rawCard.updateMany).not.toHaveBeenCalled();
  });

  it('still restocks without creating a source link when none is chosen', async () => {
    const { tx, svc, market } = make();
    await svc.add({ ...dto, marketLinkKey: undefined }, 'owner');
    expect(market.listingsFor).not.toHaveBeenCalled();
    expect(tx.rawCard.updateMany.mock.calls[0][0].data.marketListingKey).toBeUndefined();
  });

  it('returns the original receipt on retry instead of relinking or restocking again', async () => {
    const { svc, prisma, market } = make();
    const receiptId = 'b8c3a9cc-35b5-45e3-a10b-f67a06a09f8e';
    prisma.quickAddReceipt = {
      findUnique: jest.fn().mockResolvedValue({
        userId: 'owner', listingKey: `existing:${id}`, cardId: id, action: 'reactivated',
      }),
    };
    prisma.rawCard = { findUnique: jest.fn().mockResolvedValue({ id, quantity: 3 }) };
    prisma.cardImage = { findFirst: jest.fn().mockResolvedValue({ id: 'existing-photo' }) };
    const result = await svc.add({ ...dto, requestId: receiptId }, 'owner');
    expect(result.action).toBe('reactivated');
    expect(market.listingsFor).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
