import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@ApiProduces('application/pdf')
@Controller('reports')
export class ReportsController {
  constructor(private service: ReportsService) {}

  @Get('inventory/pdf') @ApiOperation({ summary: 'Inventory report (PDF)' })
  inventory(@Res() res: Response) { return this.service.inventory(res); }

  @Get('sales/pdf') @ApiOperation({ summary: 'Sales report (PDF)' })
  sales(@Res() res: Response) { return this.service.sales(res); }

  @Get('profit/pdf') @ApiOperation({ summary: 'Profit report (PDF)' })
  profit(@Res() res: Response) { return this.service.profit(res); }

  @Get('shipping/pdf') @ApiOperation({ summary: 'Shipping report (PDF)' })
  shipping(@Res() res: Response) { return this.service.shipping(res); }

  @Get('customer/pdf') @ApiOperation({ summary: 'Customer report (PDF)' })
  customer(@Res() res: Response) { return this.service.customers(res); }

  @Get('card-performance/pdf') @ApiOperation({ summary: 'Card performance report (PDF)' })
  cardPerformance(@Res() res: Response) { return this.service.cardPerformance(res); }
}
