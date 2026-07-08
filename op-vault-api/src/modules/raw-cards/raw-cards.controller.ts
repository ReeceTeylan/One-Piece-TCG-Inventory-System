import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RawCardsService } from './raw-cards.service';
import { CreateRawCardDto } from './dto/create-raw-card.dto';
import { UpdateRawCardDto } from './dto/update-raw-card.dto';
import { QueryRawCardDto } from './dto/query-raw-card.dto';
import { RestockDto } from './dto/restock.dto';
import { AddQuantityDto } from './dto/add-quantity.dto';

@ApiTags('raw-cards')
@ApiBearerAuth()
@Controller('raw-cards')
export class RawCardsController {
  constructor(private service: RawCardsService) {}

  @Get()
  findAll(@Query() query: QueryRawCardDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateRawCardDto, @CurrentUser('id') userId: string) {
    return this.service.create(dto, userId);
  }

  // When the UI's duplicate dialog is confirmed, it calls this instead of create.
  @Post(':id/add-quantity')
  addQuantity(@Param('id') id: string, @Body() dto: AddQuantityDto, @CurrentUser('id') userId: string) {
    return this.service.addQuantity(id, dto.quantity, 0, userId);
  }

  @Post(':id/restock')
  restock(@Param('id') id: string, @Body() dto: RestockDto, @CurrentUser('id') userId: string) {
    return this.service.restock(id, dto, userId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateRawCardDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.OWNER)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
