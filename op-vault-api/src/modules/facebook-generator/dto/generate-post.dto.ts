import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class GeneratePostDto {
  @ApiPropertyOptional({ type: [String], description: 'Specific raw-card ids; defaults to latest in stock' })
  @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @IsOptional() cardIds?: string[];

  @ApiPropertyOptional({ enum: ['light', 'dark'], default: 'light' })
  @IsIn(['light', 'dark']) @IsOptional() theme: 'light' | 'dark' = 'light';

  @ApiPropertyOptional({ default: true })
  @Transform(({ value }) => value === 'true' || value === true) @IsBoolean() @IsOptional() showLogo = true;

  @ApiPropertyOptional({ default: 20, description: 'Max cards (5 per row × 4 rows)' })
  @Type(() => Number) @IsInt() @Min(1) @Max(20) @IsOptional() count = 20;
}
