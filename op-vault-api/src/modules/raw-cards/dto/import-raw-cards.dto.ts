import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, ValidateNested } from 'class-validator';
import { CreateRawCardDto } from './create-raw-card.dto';

export class ImportRawCardsDto {
  @ApiProperty({ type: [CreateRawCardDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(1000) // safety cap; a single import can't exceed 1000 rows
  @ValidateNested({ each: true })
  @Type(() => CreateRawCardDto)
  rows: CreateRawCardDto[];
}