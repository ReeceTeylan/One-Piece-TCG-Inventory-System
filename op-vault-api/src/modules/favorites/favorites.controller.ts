import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { FavoritesService } from './favorites.service';
import { PinDto, ToggleFavoriteDto } from './dto/favorite.dto';

@ApiTags('favorites')
@ApiBearerAuth()
@Controller('favorites')
export class FavoritesController {
  constructor(private service: FavoritesService) {}

  @Get()
  @ApiOperation({ summary: 'List the current user’s favorite cards' })
  findAll(@CurrentUser('id') userId: string) { return this.service.findAll(userId); }

  @Get('pinned')
  @ApiOperation({ summary: 'List globally pinned cards for the dashboard' })
  pinned() { return this.service.pinned(); }

  @Post('toggle')
  @ApiOperation({ summary: 'Toggle a card as favorite for the current user' })
  toggle(@Body() dto: ToggleFavoriteDto, @CurrentUser('id') userId: string) {
    return this.service.toggle(dto, userId);
  }

  @Post('pin')
  @ApiOperation({ summary: 'Pin or unpin a card on the dashboard' })
  pin(@Body() dto: PinDto) { return this.service.pin(dto); }
}
