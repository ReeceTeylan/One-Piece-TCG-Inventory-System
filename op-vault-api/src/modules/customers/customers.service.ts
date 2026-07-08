import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { paginate } from '../../common/dto/pagination.dto';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CustomersRepository } from './customers.repository';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { QueryCustomerDto } from './dto/query-customer.dto';

@Injectable()
export class CustomersService {
  constructor(
    private repo: CustomersRepository,
    private prisma: PrismaService,
    private audit: ActivityLogsService,
    private notifications: NotificationsService,
  ) {}

  async create(dto: CreateCustomerDto, userId: string) {
    // Duplicate detection: same name + contact number.
    if (dto.contactNumber) {
      const existing = await this.repo.findByNameAndContact(dto.name, dto.contactNumber);
      if (existing) {
        throw new ConflictException({
          code: 'CUSTOMER_EXISTS',
          message: 'A customer with this name and contact number already exists.',
          customerId: existing.id,
        });
      }
    }
    const customer = await this.repo.create(dto);
    await this.audit.log({ userId, action: 'customer.create', entityType: 'Customer', entityId: customer.id });
    await this.notifications.emit({ type: 'SYSTEM', title: `New customer: ${customer.name}` });
    return customer;
  }

  async findAll(query: QueryCustomerDto) {
    const where: Prisma.CustomerWhereInput = {};
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { facebookName: { contains: query.search, mode: 'insensitive' } },
        { contactNumber: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    const sortable = ['name', 'createdAt'];
    const sortBy = sortable.includes(query.sortBy ?? '') ? query.sortBy! : 'createdAt';
    const { data, total } = await this.repo.findMany(where, { [sortBy]: query.sortOrder }, query.skip, query.limit);
    return paginate(data, total, query);
  }

  async findOne(id: string) {
    const customer = await this.repo.findById(id);
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  /** Purchase history for a customer, with per-sale item breakdown. */
  async purchaseHistory(id: string) {
    await this.findOne(id);
    return this.prisma.sale.findMany({
      where: { customerId: id },
      orderBy: { createdAt: 'desc' },
      include: {
        items: true,
        payments: true,
        shipment: { select: { status: true, courier: true, trackingNumber: true } },
      },
    });
  }

  /** Aggregate statistics (lifetime spend, orders, profit, last purchase). */
  async statistics(id: string) {
    await this.findOne(id);
    const agg = await this.prisma.sale.aggregate({
      where: { customerId: id, status: { not: 'CANCELLED' } },
      _sum: { grandTotal: true, totalProfit: true },
      _count: { _all: true },
      _max: { createdAt: true },
    });
    return {
      totalOrders: agg._count._all,
      totalSpent: agg._sum.grandTotal ?? 0,
      totalProfit: agg._sum.totalProfit ?? 0,
      lastPurchaseAt: agg._max.createdAt,
    };
  }

  async update(id: string, dto: UpdateCustomerDto, userId: string) {
    await this.findOne(id);
    const customer = await this.repo.update(id, dto);
    await this.audit.log({ userId, action: 'customer.update', entityType: 'Customer', entityId: id });
    return customer;
  }

  async remove(id: string, userId: string) {
    await this.findOne(id);
    // Guard: don't delete customers with sales history (referential integrity).
    const count = await this.prisma.sale.count({ where: { customerId: id } });
    if (count > 0) {
      throw new ConflictException({
        code: 'CUSTOMER_HAS_SALES',
        message: `Cannot delete a customer with ${count} sale(s) on record.`,
      });
    }
    await this.repo.delete(id);
    await this.audit.log({ userId, action: 'customer.delete', entityType: 'Customer', entityId: id });
    return { message: 'Customer deleted' };
  }
}
