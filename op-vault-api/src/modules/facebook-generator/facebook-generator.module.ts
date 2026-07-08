import { Module } from '@nestjs/common';
import { FacebookGeneratorService } from './facebook-generator.service';
import { FacebookGeneratorController } from './facebook-generator.controller';

@Module({
  providers: [FacebookGeneratorService],
  controllers: [FacebookGeneratorController],
})
export class FacebookGeneratorModule {}
