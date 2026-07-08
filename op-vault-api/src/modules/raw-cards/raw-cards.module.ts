import { Module } from '@nestjs/common';
import { RawCardsService } from './raw-cards.service';
import { RawCardsController } from './raw-cards.controller';
import { RawCardsRepository } from './raw-cards.repository';

@Module({
  providers: [RawCardsService, RawCardsRepository],
  controllers: [RawCardsController],
  exports: [RawCardsService],
})
export class RawCardsModule {}
