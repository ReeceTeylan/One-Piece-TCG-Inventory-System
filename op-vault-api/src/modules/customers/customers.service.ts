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
    const search = query.search?.trim();
    const searchFilter = search
      ? Prisma.sql`AND (c.name ILIKE ${`%${search}%`} OR c."facebookName" ILIKE ${`%${search}%`} OR c."contactNumber" ILIKE ${`%${search}%`})`
      : Prisma.empty;

    // Only customers with at least one real sale; ranked by profit generated.
    const rows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      SELECT c.id, c.name, c."facebookName", c."contactNumber", c.notes, c."createdAt", c."updatedAt",
             COUNT(s.id)                        AS orders,
             COALESCE(SUM(s."totalProfit"), 0)  AS profit,
             COALESCE(SUM(s."grandTotal"), 0)   AS spent
      FROM customers c
      JOIN sales s ON s."customerId" = c.id AND s.status NOT IN ('CANCELLED','REFUNDED')
      WHERE TRUE ${searchFilter}
      GROUP BY c.id
      ORDER BY profit DESC, c.name ASC
      LIMIT ${query.limit} OFFSET ${query.skip}
    `);

    const [{ count }] = await this.prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
      SELECT COUNT(*) AS count FROM (
        SELECT c.id
        FROM customers c
        JOIN sales s ON s."customerId" = c.id AND s.status NOT IN ('CANCELLED','REFUNDED')
        WHERE TRUE ${searchFilter}
        GROUP BY c.id
      ) t
    `);

    const data = rows.map((r) => ({
      ...r,
      profit: Number(r.profit),
      spent: Number(r.spent),
      _count: { sales: Number(r.orders) },
    }));
    return paginate(data, Number(count), query);
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

/** Customers sharing a name (case-insensitive), with their order counts. */
  async duplicates() {
    const rows = await this.prisma.$queryRaw<{ name: string; ids: string[]; count: bigint }[]>(Prisma.sql`
      SELECT lower(trim(name)) AS name,
             array_agg(id ORDER BY "createdAt") AS ids,
             count(*) AS count
      FROM customers
      GROUP BY lower(trim(name))
      HAVING count(*) > 1
      ORDER BY count DESC, name
    `);

    // Pull the full records so the UI can show contact details and order counts.
    const allIds = rows.flatMap((r) => r.ids);
    if (!allIds.length) return [];
    const customers = await this.prisma.customer.findMany({
      where: { id: { in: allIds } },
      include: { _count: { select: { sales: true } } },
    });
    const byId = new Map(customers.map((c) => [c.id, c]));

    return rows.map((r) => ({
      name: r.name,
      count: Number(r.count),
      customers: r.ids.map((id) => byId.get(id)).filter(Boolean),
    }));
  }

  /**
   * Move every sale from `mergeIds` onto `keepId`, then delete the emptied
   * records. Fills in any contact details the kept record is missing.
   */
  async merge(keepId: string, mergeIds: string[], userId: string) {
    const ids = mergeIds.filter((id) => id !== keepId);
    if (!ids.length) throw new ConflictException({ code: 'NOTHING_TO_MERGE', message: 'No other customers selected.' });

    return this.prisma.$transaction(async (tx) => {
      const keep = await tx.customer.findUnique({ where: { id: keepId } });
      if (!keep) throw new NotFoundException('Customer to keep not found');

      const others = await tx.customer.findMany({ where: { id: { in: ids } } });
      if (others.length !== ids.length) throw new NotFoundException('One or more customers not found');

      const moved = await tx.sale.updateMany({ where: { customerId: { in: ids } }, data: { customerId: keepId } });

      // Backfill blank fields on the kept record from the ones being removed.
      const facebookName = keep.facebookName || others.find((o) => o.facebookName)?.facebookName || null;
      const contactNumber = keep.contactNumber || others.find((o) => o.contactNumber)?.contactNumber || null;
      if (facebookName !== keep.facebookName || contactNumber !== keep.contactNumber) {
        await tx.customer.update({ where: { id: keepId }, data: { facebookName, contactNumber } });
      }

      await tx.customer.deleteMany({ where: { id: { in: ids } } });

      await this.audit.log(
        { userId, action: 'customer.merge', entityType: 'Customer', entityId: keepId,
          metadata: { merged: ids, salesMoved: moved.count } },
        tx,
      );

      return { message: `Merged ${ids.length} customer(s), moved ${moved.count} sale(s)`, keepId };
    });
  }
}