import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsPositive, Min } from 'class-validator';

export class RestockDto {
  @ApiProperty() @Type(() => Number) @IsInt() @IsPositive() quantityAdded: number;
  @ApiProperty() @Type(() => Number) @IsNumber() @Min(0) buyCost: number;
  @ApiPropertyOptional() @IsOptional() datePurchased?: string;
}
