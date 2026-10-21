import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SuggestPriceDto {
  @ApiProperty({ example: 'OP01-120' }) @IsString() @MaxLength(30) cardNumber: string;
  @ApiProperty({ example: 'PSEC' }) @IsString() @MaxLength(20) rarity: string;
  @ApiPropertyOptional({ example: 'ENG, light whites' }) @IsString() @MaxLength(500) @IsOptional() notes?: string;
}
