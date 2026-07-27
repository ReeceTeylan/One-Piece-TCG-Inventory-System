import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { ProductKind, StockStatus } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QuerySlabDto extends PaginationDto {
  @ApiPropertyOptional({ enum: StockStatus })
  @IsEnum(StockStatus) @IsOptional() status?: StockStatus;

  @ApiPropertyOptional() @Type(() => Number) @IsNumber() @IsOptional() grade?: number;

  @ApiPropertyOptional() @IsString() @IsOptional() gradingCompany?: string;

  @ApiPropertyOptional({ enum: ProductKind })
  @IsEnum(ProductKind) @IsOptional() kind?: ProductKind;

  // Default view is Available-only; service treats undefined as true.
  @ApiPropertyOptional({ default: true })
  @Transform(({ value }) => value !== 'false' && value !== false)
  @IsBoolean() @IsOptional() inStock?: boolean;
}
