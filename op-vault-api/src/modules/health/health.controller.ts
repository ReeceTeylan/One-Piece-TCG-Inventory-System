import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator'; // ← confirm this path

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  @ApiOperation({ summary: 'Liveness probe for uptime pings / keep-warm cron' })
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}