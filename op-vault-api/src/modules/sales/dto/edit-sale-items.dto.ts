import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { SaleItemInput } from './create-sale.dto';

export class EditSaleItemsDto {
  @ApiProperty({ type: [SaleItemInput] })
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => SaleItemInput)
  items: SaleItemInput[];

  @ApiPropertyOptional({ description: 'Optional new discount; keeps existing if omitted' })
  @Type(() => Number) @IsNumber() @Min(0) @IsOptional() discount?: number;

  @ApiPropertyOptional({ description: 'Optional new shipping fee; keeps existing if omitted' })
  @Type(() => Number) @IsNumber() @Min(0) @IsOptional() shippingFee?: number;

  @ApiPropertyOptional() @IsString() @IsOptional() notes?: string;
}