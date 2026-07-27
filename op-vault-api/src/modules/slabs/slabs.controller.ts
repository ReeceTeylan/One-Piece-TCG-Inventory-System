import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SlabsService } from './slabs.service';
import { RestockDto } from '../raw-cards/dto/restock.dto';
import { CreateSlabDto } from './dto/create-slab.dto';
import { UpdateSlabDto } from './dto/update-slab.dto';
import { QuerySlabDto } from './dto/query-slab.dto';

@ApiTags('slabs')
@ApiBearerAuth()
@Controller('slabs')
export class SlabsController {
  constructor(private service: SlabsService) {}

  @Get() findAll(@Query() query: QuerySlabDto) { return this.service.findAll(query); }
  @Get(':id') findOne(@Param('id') id: string) { return this.service.findOne(id); }
  @Post() create(@Body() dto: CreateSlabDto) { return this.service.create(dto); }
  // Sealed products only — the service rejects graded slabs.
  @Post(':id/restock')
  restock(@Param('id') id: string, @Body() dto: RestockDto, @CurrentUser('id') userId: string) {
    return this.service.restock(id, dto, userId);
  }

  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateSlabDto) { return this.service.update(id, dto); }
  @Delete(':id') @Roles(Role.OWNER) remove(@Param('id') id: string) { return this.service.remove(id); }
}
