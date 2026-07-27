import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { PromosService } from './promos.service';
import { CreatePromoDto } from './dto/create-promo.dto';

@ApiTags('promos')
@ApiBearerAuth()
@Controller('promos')
export class PromosController {
  constructor(private service: PromosService) {}

  @Get('active')
  active() {
    return this.service.getActive();
  }

  @Get('history')
  history() {
    return this.service.history();
  }

  @Post()
  @Roles(Role.OWNER)
  create(@Body() dto: CreatePromoDto) {
    return this.service.create(dto.percentage, dto.durationHours, dto.note);
  }

  @Patch('end')
  @Roles(Role.OWNER)
  end() {
    return this.service.endNow();
  }
}