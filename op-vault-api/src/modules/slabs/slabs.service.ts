import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { paginate } from '../../common/dto/pagination.dto';
import { CreateSlabDto } from './dto/create-slab.dto';
import { UpdateSlabDto } from './dto/update-slab.dto';
import { QuerySlabDto } from './dto/query-slab.dto';

@Injectable()
export class SlabsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateSlabDto) {
    // Enforce unique certification number.
    const existing = await this.prisma.slabCard.findUnique({ where: { slabNumber: dto.slabNumber } });
    if (existing) {
      throw new ConflictException({
        code: 'SLAB_EXISTS',
        message: `A slab with certification #${dto.slabNumber} already exists. Slabs must be unique.`,
      });
    }
    return this.prisma.slabCard.create({ data: dto });
  }

  async findAll(query: QuerySlabDto) {
    const where: Prisma.SlabCardWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.grade !== undefined) where.grade = query.grade;
    if (query.gradingCompany) where.gradingCompany = query.gradingCompany;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { cardNumber: { contains: query.search, mode: 'insensitive' } },
        { setName: { contains: query.search, mode: 'insensitive' } },
        { character: { contains: query.search, mode: 'insensitive' } },
        { notes: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    const sortable = ['name', 'sellPrice', 'grade', 'createdAt'];
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
    await this.findOne(id);
    return this.prisma.slabCard.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.slabCard.delete({ where: { id } });
    return { message: 'Slab deleted' };
  }
}
