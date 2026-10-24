import { Module } from '@nestjs/common';
import { MarketPricesController } from './market-prices.controller';
import { MarketPricesService } from './market-prices.service';
import { SlabPricesService } from './slab-prices.service';
import { QuickAddService } from './quick-add.service';
import { RawCardsModule } from '../raw-cards/raw-cards.module';

// PrismaModule, SettingsModule and ActivityLogsModule are @Global; RawCardsModule
// provides RawCardsService so Match goes through the normal price-history path.
@Module({
  imports: [RawCardsModule],
  providers: [MarketPricesService, SlabPricesService, QuickAddService],
  controllers: [MarketPricesController],
  exports: [MarketPricesService, SlabPricesService], // dashboard inventory value
})
export class MarketPricesModule {}
