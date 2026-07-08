import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SalesService } from './sales.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { QuerySaleDto } from './dto/query-sale.dto';
import { CancelSaleDto } from './dto/cancel-sale.dto';

@ApiTags('sales')
@ApiBearerAuth()
@Controller('sales')
export class SalesController {
  constructor(private service: SalesService) {}

  @Get() findAll(@Query() query: QuerySaleDto) { return this.service.findAll(query); }
  @Get(':id') findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post()
  complete(@Body() dto: CreateSaleDto, @CurrentUser('id') userId: string) {
    return this.service.completeSale(dto, userId);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  cancel(@Param('id') id: string, @Body() dto: CancelSaleDto, @CurrentUser('id') userId: string) {
    return this.service.cancelSale(id, userId, dto.reason);
  }

  @Post(':id/refund')
  @HttpCode(200)
  @Roles(Role.OWNER)
  refund(@Param('id') id: string, @Body() dto: CancelSaleDto, @CurrentUser('id') userId: string) {
    return this.service.refundSale(id, userId, dto.reason);
  }

  @Post(':id/undo')
  @HttpCode(200)
  @Roles(Role.OWNER)
  undo(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.service.undoSale(id, userId);
  }
}
