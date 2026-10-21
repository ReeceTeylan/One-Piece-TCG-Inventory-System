import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryMarketPricesDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Only cards flagged as underpriced' })
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean() @IsOptional() underpricedOnly?: boolean;
}
