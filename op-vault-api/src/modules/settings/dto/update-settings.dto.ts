import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateSettingsDto {
  @ApiPropertyOptional({ example: 'OP-Vault TCG' }) @IsString() @IsOptional() storeName?: string;
  @ApiPropertyOptional({ example: '/uploads/logo.png' }) @IsString() @IsOptional() logoUrl?: string;
  @ApiPropertyOptional({ example: 'PHP' }) @IsString() @IsOptional() currency?: string;
  @ApiPropertyOptional({ example: 80 }) @Type(() => Number) @IsNumber() @Min(0) @IsOptional() defaultShippingFee?: number;
  @ApiPropertyOptional({ example: 3 }) @Type(() => Number) @IsNumber() @Min(0) @IsOptional() lowStockThreshold?: number;
  @ApiPropertyOptional({ example: 'cost * 2.4' }) @IsString() @IsOptional() postedPriceFormula?: string;
}
