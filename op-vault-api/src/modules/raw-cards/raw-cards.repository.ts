import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

// Repository pattern: isolates all Prisma access for raw cards.
@Injectable()
export class RawCardsRepository {
  constructor(private prisma: PrismaService) {}

  findByIdentity(cardNumber: string, setName: string, rarity: string) {
    return this.prisma.rawCard.findUnique({
      where: { rawCardIdentity: { cardNumber, setName, rarity } },
    });
  }

  findById(id: string) {
    return this.prisma.rawCard.findUnique({ where: { id }, include: { images: true } });
  }

  create(data: Prisma.RawCardCreateInput) {
    return this.prisma.rawCard.create({ data });
  }

  update(id: string, data: Prisma.RawCardUpdateInput) {
    return this.prisma.rawCard.update({ where: { id }, data });
  }

  delete(id: string) {
    return this.prisma.rawCard.delete({ where: { id } });
  }

  async findMany(where: Prisma.RawCardWhereInput, orderBy: any, skip: number, take: number) {
    const [data, total] = await this.prisma.$transaction([
      this.prisma.rawCard.findMany({ where, orderBy, skip, take, include: { images: true } }),
      this.prisma.rawCard.count({ where }),
    ]);
    return { data, total };
  }
}
