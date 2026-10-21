import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import { SaleStatus } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QuerySaleDto extends PaginationDto {
  @ApiPropertyOptional({ enum: SaleStatus }) @IsEnum(SaleStatus) @IsOptional() status?: SaleStatus;
  @ApiPropertyOptional() @IsString() @IsOptional() customerId?: string;
  // Payments page: every sale with money still owed (PARTIAL + UNPAID), one paged list.
  @ApiPropertyOptional({ description: 'Only sales with a balance (PARTIAL or UNPAID)' })
  @Transform(({ value }) => value === true || value === 'true') @IsBoolean() @IsOptional() outstanding?: boolean;
  @ApiPropertyOptional({ enum: ['today', 'week', 'month', 'year'] })
  @IsIn(['today', 'week', 'month', 'year']) @IsOptional() range?: 'today' | 'week' | 'month' | 'year';
}
