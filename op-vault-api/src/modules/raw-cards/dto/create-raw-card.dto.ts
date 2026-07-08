import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateRawCardDto {
  @ApiProperty() @IsString() @IsNotEmpty() name: string;
  @ApiProperty() @IsString() @IsNotEmpty() cardNumber: string;
  @ApiProperty() @IsString() @IsNotEmpty() setName: string;
  @ApiPropertyOptional() @IsString() @IsOptional() character?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() color?: string;
  @ApiProperty({ example: 'SR' }) @IsString() @IsNotEmpty() rarity: string;
  @ApiProperty() @Type(() => Number) @IsInt() @Min(0) quantity: number;
  @ApiProperty() @Type(() => Number) @IsNumber() @Min(0) buyCost: number;
  @ApiProperty() @Type(() => Number) @IsNumber() @Min(0) postedPrice: number;
  @ApiPropertyOptional() @IsString() @IsOptional() notes?: string;
}
