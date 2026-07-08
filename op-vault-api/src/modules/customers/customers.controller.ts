import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { QueryCustomerDto } from './dto/query-customer.dto';

@ApiTags('customers')
@ApiBearerAuth()
@Controller('customers')
export class CustomersController {
  constructor(private service: CustomersService) {}

  @Get() findAll(@Query() query: QueryCustomerDto) { return this.service.findAll(query); }
  @Get(':id') findOne(@Param('id') id: string) { return this.service.findOne(id); }
  @Get(':id/purchases') purchases(@Param('id') id: string) { return this.service.purchaseHistory(id); }
  @Get(':id/statistics') stats(@Param('id') id: string) { return this.service.statistics(id); }

  @Post() create(@Body() dto: CreateCustomerDto, @CurrentUser('id') userId: string) {
    return this.service.create(dto, userId);
  }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateCustomerDto, @CurrentUser('id') userId: string) {
    return this.service.update(id, dto, userId);
  }
  @Delete(':id') @Roles(Role.OWNER) remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.service.remove(id, userId);
  }
}
