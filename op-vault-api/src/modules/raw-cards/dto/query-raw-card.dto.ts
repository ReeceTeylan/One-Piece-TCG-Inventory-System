import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { StockStatus } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryRawCardDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Only cards with quantity > 0' })
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean() @IsOptional() inStock?: boolean;
  @ApiPropertyOptional({ enum: StockStatus })
  @IsEnum(StockStatus) @IsOptional() status?: StockStatus;

  @ApiPropertyOptional() @IsString() @IsOptional() rarity?: string;

  @ApiPropertyOptional({ description: 'Minimum posted price (inclusive)' })
  @Type(() => Number) @IsNumber() @Min(0) @IsOptional() minPrice?: number;

  @ApiPropertyOptional({ description: 'Maximum posted price (inclusive)' })
  @Type(() => Number) @IsNumber() @Min(0) @IsOptional() maxPrice?: number;
}