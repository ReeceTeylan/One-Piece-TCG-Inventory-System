import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { StockStatus } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryRawCardDto extends PaginationDto {
  @ApiPropertyOptional({ enum: StockStatus })
  @IsEnum(StockStatus) @IsOptional() status?: StockStatus;

  @ApiPropertyOptional() @IsString() @IsOptional() rarity?: string;
}
