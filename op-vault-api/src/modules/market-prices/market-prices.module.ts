import { Module } from '@nestjs/common';
import { MarketPricesController } from './market-prices.controller';
import { MarketPricesService } from './market-prices.service';

// PrismaModule and SettingsModule are @Global, so no imports needed.
@Module({
  providers: [MarketPricesService],
  controllers: [MarketPricesController],
})
export class MarketPricesModule {}
