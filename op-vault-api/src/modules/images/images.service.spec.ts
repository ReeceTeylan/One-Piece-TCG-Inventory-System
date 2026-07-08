import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';

jest.mock('sharp', () => {
  const chain: any = {};
  chain.resize = () => chain;
  chain.webp = () => chain;
  chain.toBuffer = async () => Buffer.from('img');
  return { __esModule: true, default: jest.fn(() => chain) };
});

import { ImagesService } from './images.service';
import { PrismaService } from '../../prisma/prisma.service';
import { STORAGE_PROVIDER } from './storage/storage.interface';

describe('ImagesService', () => {
  let service: ImagesService;
  let prisma: any;
  let storage: any;

  beforeEach(async () => {
    prisma = {
      rawCard: { findUnique: jest.fn() },
      slabCard: { findUnique: jest.fn() },
      cardImage: { create: jest.fn().mockResolvedValue({ id: 'img1', url: 'http://x/uploads/cards/a.webp' }), findUnique: jest.fn(), delete: jest.fn() },
    };
    storage = { save: jest.fn().mockResolvedValue({ url: 'http://x/uploads/cards/a.webp', storageKey: 'cards/a.webp' }), delete: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        ImagesService,
        { provide: PrismaService, useValue: prisma },
        { provide: STORAGE_PROVIDER, useValue: storage },
      ],
    }).compile();
    service = moduleRef.get(ImagesService);
  });

  it('throws when the target raw card does not exist', async () => {
    prisma.rawCard.findUnique.mockResolvedValue(null);
    await expect(
      service.upload({ buffer: Buffer.from('x') } as any, { itemType: 'RAW', itemId: 'nope' } as any),
    ).rejects.toThrow(NotFoundException);
  });

  it('processes and stores main + thumbnail then records the image', async () => {
    prisma.rawCard.findUnique.mockResolvedValue({ id: 'r1' });
    const res = await service.upload({ buffer: Buffer.from('x') } as any, { itemType: 'RAW', itemId: 'r1' } as any);
    expect(storage.save).toHaveBeenCalledTimes(2); // main + thumb
    expect(prisma.cardImage.create).toHaveBeenCalled();
    expect(res).toHaveProperty('thumbnailUrl');
  });
});
