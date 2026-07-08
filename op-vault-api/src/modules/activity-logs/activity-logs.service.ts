import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { paginate } from '../../common/dto/pagination.dto';
import { QueryActivityLogDto } from './dto/query-activity-log.dto';

export interface LogInput {
  userId?: string | null;
  action: string;                       // e.g. 'sale.complete'
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
}

@Injectable()
export class ActivityLogsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Write an audit record. Accepts an optional Prisma transaction client so the
   * log can participate in the same atomic transaction as the action it audits.
   */
  log(input: LogInput, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prisma;
    return client.activityLog.create({
      data: {
        userId: input.userId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: input.metadata as Prisma.InputJsonValue,
        ipAddress: input.ipAddress,
      },
    });
  }

  async findAll(query: QueryActivityLogDto) {
    const where: Prisma.ActivityLogWhereInput = {};
    if (query.action) where.action = { contains: query.action, mode: 'insensitive' };
    if (query.entityType) where.entityType = query.entityType;
    if (query.userId) where.userId = query.userId;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.activityLog.findMany({
        where, orderBy: { createdAt: query.sortOrder },
        skip: query.skip, take: query.limit,
        include: { user: { select: { id: true, fullName: true, role: true } } },
      }),
      this.prisma.activityLog.count({ where }),
    ]);
    return paginate(data, total, query);
  }
}
