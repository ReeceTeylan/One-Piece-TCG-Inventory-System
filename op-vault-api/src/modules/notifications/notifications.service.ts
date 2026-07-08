import { Injectable, NotFoundException } from '@nestjs/common';
import { NotifType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { paginate } from '../../common/dto/pagination.dto';
import { QueryNotificationDto } from './dto/query-notification.dto';

export interface EmitInput {
  type: NotifType;
  title: string;
  body?: string;
  userId?: string | null;
}

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  /** Create a notification. tx-aware so it can join a surrounding transaction. */
  emit(input: EmitInput, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prisma;
    return client.notification.create({
      data: { type: input.type, title: input.title, body: input.body, userId: input.userId ?? null },
    });
  }

  /** Low-stock check for a single raw card; emits once when at/below threshold. */
  async emitLowStock(rawCard: { id: string; name: string; quantity: number }, threshold: number) {
    if (rawCard.quantity > threshold) return null;
    const type: NotifType = rawCard.quantity <= 0 ? 'OUT_OF_STOCK' : 'LOW_STOCK';
    return this.emit({
      type,
      title: rawCard.quantity <= 0 ? `Out of stock: ${rawCard.name}` : `Low stock: ${rawCard.name}`,
      body: `${rawCard.quantity} remaining`,
    });
  }

  async findAll(query: QueryNotificationDto, userId: string) {
    const where: Prisma.NotificationWhereInput = {
      OR: [{ userId }, { userId: null }],
    };
    if (query.type) where.type = query.type;
    if (query.isRead !== undefined) where.isRead = query.isRead;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where, orderBy: { createdAt: 'desc' }, skip: query.skip, take: query.limit,
      }),
      this.prisma.notification.count({ where }),
    ]);
    return paginate(data, total, query);
  }

  async unreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { isRead: false, OR: [{ userId }, { userId: null }] },
    });
    return { unread: count };
  }

  async markRead(id: string) {
    const n = await this.prisma.notification.findUnique({ where: { id } });
    if (!n) throw new NotFoundException('Notification not found');
    return this.prisma.notification.update({ where: { id }, data: { isRead: true } });
  }

  async markAllRead(userId: string) {
    const res = await this.prisma.notification.updateMany({
      where: { isRead: false, OR: [{ userId }, { userId: null }] },
      data: { isRead: true },
    });
    return { updated: res.count };
  }

  async dismiss(id: string) {
    const n = await this.prisma.notification.findUnique({ where: { id } });
    if (!n) throw new NotFoundException('Notification not found');
    await this.prisma.notification.delete({ where: { id } });
    return { message: 'Notification dismissed' };
  }
}
