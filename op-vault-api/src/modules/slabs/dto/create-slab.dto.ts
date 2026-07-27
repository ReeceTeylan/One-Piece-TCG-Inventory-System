import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min, ValidateIf } from 'class-validator';
import { ProductKind } from '@prisma/client';

export class CreateSlabDto {
  @ApiProperty() @IsString() @IsNotEmpty() name: string;
  @ApiPropertyOptional() @IsString() @IsOptional() cardNumber?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() setName?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() character?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() color?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() rarity?: string;
  @ApiPropertyOptional({ enum: ProductKind, default: ProductKind.SLAB })
  @IsEnum(ProductKind) @IsOptional() kind?: ProductKind;

  // Grading fields stay required for SLAB, skipped entirely for SEALED.
  @ApiPropertyOptional({ example: 'PSA' })
  @ValidateIf((o) => o.kind !== ProductKind.SEALED)
  @IsString() @IsNotEmpty() gradingCompany?: string;

  @ApiPropertyOptional()
  @ValidateIf((o) => o.kind !== ProductKind.SEALED)
  @IsString() @IsNotEmpty() slabNumber?: string;

  @ApiPropertyOptional({ example: 10 })
  @ValidateIf((o) => o.kind !== ProductKind.SEALED)
  @Type(() => Number) @IsNumber() @Min(1) @Max(10) grade?: number;

  // Only meaningful for SEALED. Service forces 1 for SLAB.
  @ApiPropertyOptional({ example: 1, default: 1 })
  @Type(() => Number) @IsInt() @Min(0) @IsOptional() quantity?: number;
  @ApiProperty() @Type(() => Number) @IsNumber() @Min(0) buyCost: number;
  @ApiProperty() @Type(() => Number) @IsNumber() @Min(0) sellPrice: number;
  @ApiPropertyOptional() @IsString() @IsOptional() notes?: string;
}
