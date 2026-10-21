import { Module } from '@nestjs/common';
import { StockCountController } from './stock-count.controller';
import { StockCountService } from './stock-count.service';

// PrismaModule and ActivityLogsModule are @Global, so no imports needed.
@Module({
  providers: [StockCountService],
  controllers: [StockCountController],
})
export class StockCountModule {}
