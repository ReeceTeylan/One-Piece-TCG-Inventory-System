import { PartialType } from '@nestjs/swagger';
import { CreateRawCardDto } from './create-raw-card.dto';
export class UpdateRawCardDto extends PartialType(CreateRawCardDto) {}
