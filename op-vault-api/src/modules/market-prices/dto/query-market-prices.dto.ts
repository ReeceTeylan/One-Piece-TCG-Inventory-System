import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryMarketPricesDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Only cards flagged as underpriced' })
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean() @IsOptional() underpricedOnly?: boolean;

  /** "changes" (default): only cards whose market price moved in the last day.
   *  "unlinked": cards with no market price (never linked, match removed, or listing gone). */
  @ApiPropertyOptional({ enum: ['changes', 'all', 'unlinked'], default: 'changes' })
  @IsIn(['changes', 'all', 'unlinked']) @IsOptional() view?: 'changes' | 'all' | 'unlinked';

  @ApiPropertyOptional({ enum: ['change', 'price_desc', 'price_asc', 'recent', 'margin_desc', 'underpriced'] })
  @IsIn(['change', 'price_desc', 'price_asc', 'recent', 'margin_desc', 'underpriced']) @IsOptional()
  sort?: 'change' | 'price_desc' | 'price_asc' | 'recent' | 'margin_desc' | 'underpriced';

  @ApiPropertyOptional({ enum: ['JP', 'EN'] })
  @IsIn(['JP', 'EN']) @IsOptional() language?: 'JP' | 'EN';

  @ApiPropertyOptional({ enum: ['clean', 'issues'] })
  @IsIn(['clean', 'issues']) @IsOptional() condition?: 'clean' | 'issues';
}
