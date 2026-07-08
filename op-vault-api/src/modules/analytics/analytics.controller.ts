import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { TopQueryDto, TrendQueryDto } from './dto/analytics-query.dto';

@ApiTags('analytics')
@ApiBearerAuth()
@Controller('analytics')
export class AnalyticsController {
  constructor(private service: AnalyticsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Dashboard summary: revenue/profit/orders by range + growth + inventory health' })
  dashboard() { return this.service.dashboard(); }

  @Get('trends')
  @ApiOperation({ summary: 'Time-bucketed revenue/profit/cardsSold series for line charts' })
  trends(@Query() query: TrendQueryDto) { return this.service.trends(query); }

  @Get('inventory')
  @ApiOperation({ summary: 'Inventory value, average cost/price, margin, low/dead stock counts' })
  inventory() { return this.service.inventory(); }

  @Get('cards')
  @ApiOperation({ summary: 'Best sellers, most valuable, highest profit, top rarities, fastest/slowest, dead/low stock' })
  cards(@Query() query: TopQueryDto) { return this.service.cards(query); }

  @Get('slabs')
  @ApiOperation({ summary: 'Slab analytics: totals, revenue, profit, average grade sold' })
  slabs() { return this.service.slabs(); }

  @Get('customers')
  @ApiOperation({ summary: 'Top customers by lifetime spend' })
  customers(@Query() query: TopQueryDto) { return this.service.customers(query); }
}
