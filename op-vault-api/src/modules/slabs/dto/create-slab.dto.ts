import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateSlabDto {
  @ApiProperty() @IsString() @IsNotEmpty() name: string;
  @ApiPropertyOptional() @IsString() @IsOptional() cardNumber?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() setName?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() character?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() color?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() rarity?: string;
  @ApiProperty({ example: 'PSA' }) @IsString() @IsNotEmpty() gradingCompany: string;
  @ApiProperty() @IsString() @IsNotEmpty() slabNumber: string;
  @ApiProperty({ example: 10 }) @Type(() => Number) @IsNumber() @Min(1) @Max(10) grade: number;
  @ApiProperty() @Type(() => Number) @IsNumber() @Min(0) buyCost: number;
  @ApiProperty() @Type(() => Number) @IsNumber() @Min(0) sellPrice: number;
  @ApiPropertyOptional() @IsString() @IsOptional() notes?: string;
}
