import { Module } from '@nestjs/common';
import { SlabsService } from './slabs.service';
import { SlabsController } from './slabs.controller';

@Module({
  providers: [SlabsService],
  controllers: [SlabsController],
  exports: [SlabsService],
})
export class SlabsModule {}
