import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateSettingsDto {
  @ApiPropertyOptional({ example: 'OP-Vault TCG' }) @IsString() @IsOptional() storeName?: string;
  @ApiPropertyOptional({ example: '/uploads/logo.png' }) @IsString() @IsOptional() logoUrl?: string;
  @ApiPropertyOptional({ example: 'PHP' }) @IsString() @IsOptional() currency?: string;
  @ApiPropertyOptional({ example: 80 }) @Type(() => Number) @IsNumber() @Min(0) @IsOptional() defaultShippingFee?: number;
  @ApiPropertyOptional({ example: 3 }) @Type(() => Number) @IsNumber() @Min(0) @IsOptional() lowStockThreshold?: number;
  @ApiPropertyOptional({ example: 'cost * 2.4' }) @IsString() @IsOptional() postedPriceFormula?: string;
  @ApiPropertyOptional({ example: 0.38, description: 'Pesos per 1 yen' }) @Type(() => Number) @IsNumber() @Min(0.01) @Max(10) @IsOptional() jpyToPhpRate?: number;
  @ApiPropertyOptional({ example: 90, description: 'Flag underpriced below this % of market' }) @Type(() => Number) @IsNumber() @Min(1) @Max(100) @IsOptional() underpricedPct?: number;
  @ApiPropertyOptional({ example: 58, description: 'Pesos per 1 US dollar (TCGplayer)' }) @Type(() => Number) @IsNumber() @Min(0.01) @Max(1000) @IsOptional() usdToPhpRate?: number;
  @ApiPropertyOptional({ example: 0.3, description: 'Pesos per 1 yen for damaged cards' }) @Type(() => Number) @IsNumber() @Min(0.01) @Max(10) @IsOptional() jpyToPhpRateDamaged?: number;
  @ApiPropertyOptional({ example: 45, description: 'Pesos per 1 US dollar for damaged cards' }) @Type(() => Number) @IsNumber() @Min(0.01) @Max(1000) @IsOptional() usdToPhpRateDamaged?: number;
}
