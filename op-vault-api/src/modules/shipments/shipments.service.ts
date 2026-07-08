import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ShipStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { paginate } from '../../common/dto/pagination.dto';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UpdateShipmentDto } from './dto/update-shipment.dto';
import { QueryShipmentDto } from './dto/query-shipment.dto';

// Allowed forward transitions (plus CANCELLED from any non-delivered state).
const FLOW: Record<ShipStatus, ShipStatus[]> = {
  TO_PACK: ['READY', 'CANCELLED'],
  READY: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
};

@Injectable()
export class ShipmentsService {
  constructor(
    private prisma: PrismaService,
    private audit: ActivityLogsService,
    private notifications: NotificationsService,
  ) {}

  async findAll(query: QueryShipmentDto) {
    const where: Prisma.ShipmentWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.courier) where.courier = query.courier;
    if (query.search) {
      where.OR = [
        { trackingNumber: { contains: query.search, mode: 'insensitive' } },
        { sale: { customer: { name: { contains: query.search, mode: 'insensitive' } } } },
        { sale: { reference: { contains: query.search, mode: 'insensitive' } } },
      ];
    }
    const [data, total] = await this.prisma.$transaction([
      this.prisma.shipment.findMany({
        where, orderBy: { createdAt: query.sortOrder }, skip: query.skip, take: query.limit,
        include: {
          items: true,
          sale: { include: { customer: { select: { name: true } } } },
        },
      }),
      this.prisma.shipment.count({ where }),
    ]);
    return paginate(data, total, query);
  }

  async findOne(id: string) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id },
      include: {
        items: true,
        events: { orderBy: { createdAt: 'asc' } },
        sale: { include: { customer: true } },
      },
    });
    if (!shipment) throw new NotFoundException('Shipment not found');
    return shipment;
  }

  /** Timeline for a shipment. */
  async timeline(id: string) {
    await this.findOne(id);
    return this.prisma.shipmentEvent.findMany({ where: { shipmentId: id }, orderBy: { createdAt: 'asc' } });
  }

  async update(id: string, dto: UpdateShipmentDto, userId: string) {
    const shipment = await this.findOne(id);

    if (dto.status && dto.status !== shipment.status) {
      const allowed = FLOW[shipment.status];
      if (!allowed.includes(dto.status)) {
        throw new BadRequestException(
          `Invalid transition ${shipment.status} → ${dto.status}. Allowed: ${allowed.join(', ') || 'none'}`,
        );
      }
    }

    const data: Prisma.ShipmentUpdateInput = {};
    if (dto.courier) data.courier = dto.courier;
    if (dto.trackingNumber !== undefined) data.trackingNumber = dto.trackingNumber;
    if (dto.status) {
      data.status = dto.status;
      if (dto.status === 'SHIPPED') data.dateShipped = new Date();
      if (dto.status === 'DELIVERED') data.dateDelivered = new Date();
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const s = await tx.shipment.update({ where: { id }, data });
      if (dto.status && dto.status !== shipment.status) {
        await tx.shipmentEvent.create({
          data: { shipmentId: id, status: dto.status, note: dto.note ?? null },
        });
      }
      await this.audit.log(
        { userId, action: 'shipment.update', entityType: 'Shipment', entityId: id,
          metadata: { status: dto.status, trackingNumber: dto.trackingNumber } },
        tx,
      );
      return s;
    });
    if (dto.status === 'DELIVERED') {
      await this.notifications.emit({
        type: 'SHIPMENT',
        title: `Delivered: ${shipment.sale?.customer?.name ?? 'order'}`,
        body: `Shipment for ${shipment.sale?.reference ?? ''} was delivered`,
      });
    }
    return updated;
  }
}
