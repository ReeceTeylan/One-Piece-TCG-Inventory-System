import { BadRequestException, Injectable } from '@nestjs/common';
import { ItemType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PinDto, ToggleFavoriteDto } from './dto/favorite.dto';

@Injectable()
export class FavoritesService {
  constructor(private prisma: PrismaService) {}

  private key(itemType: ItemType, itemId: string) {
    return itemType === 'RAW' ? { rawCardId: itemId } : { slabId: itemId };
  }

  /** Toggle a per-user favorite. Returns { favorited: boolean }. */
  async toggle(dto: ToggleFavoriteDto, userId: string) {
    const where = { userId, ...this.key(dto.itemType, dto.itemId) };
    const existing = await this.prisma.favorite.findFirst({ where });
    if (existing) {
      await this.prisma.favorite.delete({ where: { id: existing.id } });
      return { favorited: false };
    }
    await this.prisma.favorite.create({ data: { userId, itemType: dto.itemType, ...this.key(dto.itemType, dto.itemId) } });
    return { favorited: true };
  }

  /** Set the global isPinned flag (used by dashboard pinned widgets). */
  async pin(dto: PinDto) {
    if (dto.itemType === 'RAW') {
      await this.prisma.rawCard.update({ where: { id: dto.itemId }, data: { isPinned: dto.pinned } });
    } else if (dto.itemType === 'SLAB') {
      await this.prisma.slabCard.update({ where: { id: dto.itemId }, data: { isPinned: dto.pinned } });
    } else {
      throw new BadRequestException('Invalid item type');
    }
    return { pinned: dto.pinned };
  }

  /** All favorites for a user, hydrated with card data. */
  async findAll(userId: string) {
    const favorites = await this.prisma.favorite.findMany({
      where: { userId },
      include: {
        rawCard: { include: { images: true } },
        slab: { include: { images: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return favorites.map((f) => ({
      id: f.id,
      itemType: f.itemType,
      item: f.itemType === 'RAW' ? f.rawCard : f.slab,
    }));
  }

  /** Pinned cards for the dashboard. */
  async pinned() {
    const [rawCards, slabs] = await this.prisma.$transaction([
      this.prisma.rawCard.findMany({ where: { isPinned: true }, include: { images: true } }),
      this.prisma.slabCard.findMany({ where: { isPinned: true }, include: { images: true } }),
    ]);
    return { rawCards, slabs };
  }
}
