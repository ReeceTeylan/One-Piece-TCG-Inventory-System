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
    const slab = await this.findOne(id);
    if (slab.kind !== 'SEALED') {
      throw new ConflictException({
        code: 'SLAB_NOT_STACKABLE',
        message: 'Graded slabs are unique items — quantity applies to sealed products only.',
      });
    }

    const newQty = slab.quantity + quantity;

    // Weighted-average cost, same rule as raw cards: a 0 cost means
    // "just add stock" and leaves the existing cost untouched.
    let newBuyCost = Number(slab.buyCost);
    if (buyCost > 0) {
      const oldQty = slab.quantity;
      const oldCost = Number(slab.buyCost);
      const totalQty = oldQty + quantity;
      newBuyCost = totalQty > 0 ? (oldQty * oldCost + quantity * buyCost) / totalQty : buyCost;
    }

    return this.prisma.$transaction(async (tx) => {
      const s = await tx.slabCard.update({
        where: { id },
        data: {
          quantity: newQty,
          status: this.computeStatus(newQty),
          buyCost: new Prisma.Decimal(newBuyCost.toFixed(2)),
        },
      });
      await tx.restockLog.create({ data: { slabId: id, quantityAdded: quantity, buyCost, userId } });
      await tx.inventoryLog.create({
        data: {
          itemType: 'SLAB', slabId: id, action: 'RESTOCK',
          quantityDelta: quantity, quantityAfter: newQty, userId,
        },
      });
      return s;
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
