import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { StockStatus } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QuerySlabDto extends PaginationDto {
  @ApiPropertyOptional({ enum: StockStatus })
  @IsEnum(StockStatus) @IsOptional() status?: StockStatus;

  @ApiPropertyOptional() @Type(() => Number) @IsNumber() @IsOptional() grade?: number;

  @ApiPropertyOptional() @IsString() @IsOptional() gradingCompany?: string;
}
