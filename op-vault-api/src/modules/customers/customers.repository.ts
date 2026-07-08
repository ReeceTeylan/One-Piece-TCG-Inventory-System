import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CustomersRepository {
  constructor(private prisma: PrismaService) {}

  create(data: Prisma.CustomerCreateInput) {
    return this.prisma.customer.create({ data });
  }
  findById(id: string) {
    return this.prisma.customer.findUnique({ where: { id } });
  }
  findByNameAndContact(name: string, contactNumber?: string | null) {
    return this.prisma.customer.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        ...(contactNumber ? { contactNumber } : {}),
      },
    });
  }
  update(id: string, data: Prisma.CustomerUpdateInput) {
    return this.prisma.customer.update({ where: { id }, data });
  }
  delete(id: string) {
    return this.prisma.customer.delete({ where: { id } });
  }
  async findMany(where: Prisma.CustomerWhereInput, orderBy: any, skip: number, take: number) {
    const [data, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where, orderBy, skip, take,
        include: { _count: { select: { sales: true } } },
      }),
      this.prisma.customer.count({ where }),
    ]);
    return { data, total };
  }
}
