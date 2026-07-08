import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import { SaleStatus } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QuerySaleDto extends PaginationDto {
  @ApiPropertyOptional({ enum: SaleStatus }) @IsEnum(SaleStatus) @IsOptional() status?: SaleStatus;
  @ApiPropertyOptional() @IsString() @IsOptional() customerId?: string;
  @ApiPropertyOptional({ enum: ['today', 'week', 'month', 'year'] })
  @IsIn(['today', 'week', 'month', 'year']) @IsOptional() range?: 'today' | 'week' | 'month' | 'year';
}
