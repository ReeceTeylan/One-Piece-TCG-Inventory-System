import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StockStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { paginate } from '../../common/dto/pagination.dto';
import { CreateSlabDto } from './dto/create-slab.dto';
import { UpdateSlabDto } from './dto/update-slab.dto';
import { QuerySlabDto } from './dto/query-slab.dto';
import { RestockDto } from '../raw-cards/dto/restock.dto';

@Injectable()
export class SlabsService {
  constructor(private prisma: PrismaService) {}

  // Sealed products only — a graded slab's status stays manual.
  private computeStatus(qty: number): StockStatus {
    return qty <= 0 ? 'SOLD' : 'AVAILABLE';
  }

  async create(dto: CreateSlabDto) {
    const kind = dto.kind ?? 'SLAB';

    if (kind === 'SEALED') {
      const quantity = dto.quantity ?? 1;
      return this.prisma.slabCard.create({
        data: {
          ...dto,
          kind,
          quantity,
          status: this.computeStatus(quantity),
          // Grading fields are meaningless for a sealed product.
          gradingCompany: null,
          slabNumber: null,
          grade: null,
        },
      });
    }

    // SLAB — cert number must be globally unique, and there is always exactly one copy.
    const existing = await this.prisma.slabCard.findUnique({
      where: { slabNumber: dto.slabNumber! },
    });
    if (existing) {
      throw new ConflictException({
        code: 'SLAB_EXISTS',
        message: `A slab with certification #${dto.slabNumber} already exists. Slabs must be unique.`,
      });
    }
    return this.prisma.slabCard.create({ data: { ...dto, kind, quantity: 1 } });
  }

  async findAll(query: QuerySlabDto) {
    const where: Prisma.SlabCardWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.grade !== undefined) where.grade = query.grade;
    if (query.gradingCompany) where.gradingCompany = query.gradingCompany;
    if (query.kind) where.kind = query.kind;
    // Default view is Available-only. An explicit status filter overrides it,
    // otherwise selecting "Sold" would return nothing (sold rows have quantity 0).
    if (query.inStock !== false && !query.status) where.quantity = { gt: 0 };
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { cardNumber: { contains: query.search, mode: 'insensitive' } },
        { setName: { contains: query.search, mode: 'insensitive' } },
        { character: { contains: query.search, mode: 'insensitive' } },
        { notes: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    const sortable = ['name', 'sellPrice', 'grade', 'quantity', 'buyCost', 'createdAt'];
    const sortBy = sortable.includes(query.sortBy ?? '') ? query.sortBy! : 'createdAt';
    const [data, total] = await this.prisma.$transaction([
      this.prisma.slabCard.findMany({
        where, orderBy: { [sortBy]: query.sortOrder },
        skip: query.skip, take: query.limit, include: { images: true },
      }),
      this.prisma.slabCard.count({ where }),
    ]);
    return paginate(data, total, query);
  }

  async findOne(id: string) {
    const slab = await this.prisma.slabCard.findUnique({ where: { id }, include: { images: true } });
    if (!slab) throw new NotFoundException('Slab not found');
    return slab;
  }

  async update(id: string, dto: UpdateSlabDto) {
    const slab = await this.findOne(id);
    const data: Prisma.SlabCardUpdateInput = { ...dto };

    if (slab.kind === 'SEALED') {
      // Sealed status is derived from quantity, and grading fields never apply.
      if (dto.quantity !== undefined) data.status = this.computeStatus(dto.quantity);
      delete data.slabNumber;
      delete data.gradingCompany;
      delete data.grade;
    } else {
      // A graded slab is a single physical item — quantity is not editable.
      delete data.quantity;
    }

    return this.prisma.slabCard.update({ where: { id }, data });
  }

  async addQuantity(id: string, quantity: number, buyCost: number, userId: string) {
    if (!Number.isInteger(quantity) || quantity <= 0 || !Number.isFinite(buyCost) || buyCost < 0)
      throw new BadRequestException('Quantity must be positive and buying cost nonnegative');
    return this.prisma.$transaction(async tx => {
      const slab = await tx.slabCard.findUnique({ where: { id } });
      if (!slab) throw new NotFoundException('Item not found');
      if (slab.kind !== 'SEALED') throw new BadRequestException('Only sealed products can be restocked');
      const newQty = slab.quantity + quantity;
      const average = buyCost > 0
        ? (slab.quantity * Number(slab.buyCost) + quantity * buyCost) / newQty
        : Number(slab.buyCost);
      const updated = await tx.slabCard.updateMany({
        where: { id, quantity: slab.quantity },
        data: { quantity: newQty, status: this.computeStatus(newQty), buyCost: new Prisma.Decimal(average.toFixed(2)) },
      });
      if (updated.count !== 1) throw new ConflictException('Stock changed while restocking. Refresh and retry.');
      await tx.restockLog.create({ data: { slabId: id, quantityAdded: quantity, buyCost, userId } });
      await tx.inventoryLog.create({ data: { itemType: 'SLAB', slabId: id, action: 'RESTOCK', quantityDelta: quantity, quantityAfter: newQty, userId } });
      return tx.slabCard.findUniqueOrThrow({ where: { id } });
    });
  }

  restock(id: string, dto: RestockDto, userId: string) {
    return this.addQuantity(id, dto.quantityAdded, dto.buyCost, userId);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.slabCard.delete({ where: { id } });
    return { message: 'Slab deleted' };
  }
}
