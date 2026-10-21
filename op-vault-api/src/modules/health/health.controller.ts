import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Liveness probe for uptime pings / keep-warm cron' })
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  /** Keep-alive target for the uptime monitor: touches the database so the
   *  ping keeps Render awake AND counts as Supabase activity (prevents the
   *  free-tier 7-day pause). Returns 503 if the DB is unreachable. */
  @Public()
  @Get('db')
  @ApiOperation({ summary: 'Readiness probe — runs SELECT 1 against the database' })
  async checkDb() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', db: 'up', timestamp: new Date().toISOString() };
    } catch {
      throw new ServiceUnavailableException({ status: 'error', db: 'down' });
    }
  }
}
