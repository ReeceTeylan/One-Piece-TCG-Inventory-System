import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { StockCountService } from './stock-count.service';
import { AdjustStockDto } from './dto/adjust-stock.dto';

@ApiTags('stock-count')
@ApiBearerAuth()
@Controller('stock-count')
export class StockCountController {
  constructor(private service: StockCountService) {}

  @Post('adjust')
  @ApiOperation({ summary: 'Set an item to its physically counted quantity (logged as ADJUST)' })
  adjust(@Body() dto: AdjustStockDto, @CurrentUser('id') userId: string) {
    return this.service.adjust(dto, userId);
  }
}
