import { Test } from '@nestjs/testing';
import { FavoritesService } from './favorites.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('FavoritesService', () => {
  let service: FavoritesService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      favorite: { findFirst: jest.fn(), create: jest.fn().mockResolvedValue({}), delete: jest.fn().mockResolvedValue({}) },
      rawCard: { update: jest.fn().mockResolvedValue({}) },
      slabCard: { update: jest.fn().mockResolvedValue({}) },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [FavoritesService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(FavoritesService);
  });

  it('adds a favorite when none exists', async () => {
    prisma.favorite.findFirst.mockResolvedValue(null);
    const res = await service.toggle({ itemType: 'RAW', itemId: 'r1' } as any, 'u1');
    expect(res.favorited).toBe(true);
    expect(prisma.favorite.create).toHaveBeenCalled();
  });

  it('removes a favorite when it exists', async () => {
    prisma.favorite.findFirst.mockResolvedValue({ id: 'f1' });
    const res = await service.toggle({ itemType: 'RAW', itemId: 'r1' } as any, 'u1');
    expect(res.favorited).toBe(false);
    expect(prisma.favorite.delete).toHaveBeenCalled();
  });

  it('pins a raw card', async () => {
    const res = await service.pin({ itemType: 'RAW', itemId: 'r1', pinned: true } as any);
    expect(res.pinned).toBe(true);
    expect(prisma.rawCard.update).toHaveBeenCalledWith({ where: { id: 'r1' }, data: { isPinned: true } });
  });
});
