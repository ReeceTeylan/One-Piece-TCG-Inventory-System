import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class TrendQueryDto {
  @ApiPropertyOptional({ enum: ['daily', 'monthly', 'yearly'], default: 'daily' })
  @IsIn(['daily', 'monthly', 'yearly']) 
  @IsOptional() 
  granularity: 'daily' | 'monthly' | 'yearly' = 'daily';

  @ApiPropertyOptional({ default: 30, description: 'Number of buckets to return' })
  @Type(() => Number) 
  @IsInt() 
  @Min(1) 
  @Max(365) 
  @IsOptional() 
  points = 30;

  @ApiPropertyOptional({ description: 'Filter by specific month (e.g., "2026-07")' })
  @IsOptional()
  @IsString()
  targetMonth?: string;
}

export class TopQueryDto {
  @ApiPropertyOptional({ default: 10 })
  @Type(() => Number) 
  @IsInt() 
  @Min(1) 
  @Max(50) 
  @IsOptional() 
  limit = 10;
}