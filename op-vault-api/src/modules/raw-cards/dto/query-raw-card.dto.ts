import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { StockStatus } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryRawCardDto extends PaginationDto {
  @ApiPropertyOptional({ enum: StockStatus })
  @IsEnum(StockStatus) @IsOptional() status?: StockStatus;

  @ApiPropertyOptional() @IsString() @IsOptional() rarity?: string;

  @ApiPropertyOptional({ description: 'Minimum posted price (inclusive)' })
  @Type(() => Number) @IsNumber() @Min(0) @IsOptional() minPrice?: number;

  @ApiPropertyOptional({ description: 'Maximum posted price (inclusive)' })
  @Type(() => Number) @IsNumber() @Min(0) @IsOptional() maxPrice?: number;
}