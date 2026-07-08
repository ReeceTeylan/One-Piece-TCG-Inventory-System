import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ShipmentsService } from './shipments.service';
import { UpdateShipmentDto } from './dto/update-shipment.dto';
import { QueryShipmentDto } from './dto/query-shipment.dto';

@ApiTags('shipments')
@ApiBearerAuth()
@Controller('shipments')
export class ShipmentsController {
  constructor(private service: ShipmentsService) {}

  @Get() findAll(@Query() query: QueryShipmentDto) { return this.service.findAll(query); }
  @Get(':id') findOne(@Param('id') id: string) { return this.service.findOne(id); }
  @Get(':id/timeline') timeline(@Param('id') id: string) { return this.service.timeline(id); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateShipmentDto, @CurrentUser('id') userId: string) {
    return this.service.update(id, dto, userId);
  }
}
