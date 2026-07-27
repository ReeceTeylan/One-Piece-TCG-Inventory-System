import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreatePromoDto {
  @ApiProperty({ description: 'Percent off, e.g. 10 = 10% off' })
  @Type(() => Number) @IsNumber() @Min(0.01) @Max(99) percentage: number;

  @ApiProperty({ description: 'How long the promo runs, in hours' })
  @Type(() => Number) @IsNumber() @Min(0.5) @Max(720) durationHours: number;

  @ApiPropertyOptional() @IsString() @IsOptional() note?: string;
}