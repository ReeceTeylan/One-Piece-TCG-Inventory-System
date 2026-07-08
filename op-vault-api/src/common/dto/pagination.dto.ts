import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class PaginationDto {
  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number) @IsInt() @Min(1) @IsOptional()
  page = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @Type(() => Number) @IsInt() @Min(1) @Max(100) @IsOptional()
  limit = 20;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  search?: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsIn(['asc', 'desc']) @IsOptional()
  sortOrder: 'asc' | 'desc' = 'desc';

  get skip(): number {
    return (this.page - 1) * this.limit;
  }
}

export interface Paginated<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export function paginate<T>(data: T[], total: number, dto: PaginationDto): Paginated<T> {
  return {
    data,
    meta: {
      total,
      page: dto.page,
      limit: dto.limit,
      totalPages: Math.ceil(total / dto.limit) || 1,
    },
  };
}
