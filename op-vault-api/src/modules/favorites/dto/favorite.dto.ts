import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { ItemType } from '@prisma/client';

export class ToggleFavoriteDto {
  @ApiProperty({ enum: ItemType }) @IsEnum(ItemType) itemType: ItemType;
  @ApiProperty() @IsString() itemId: string;
}

export class PinDto {
  @ApiProperty({ enum: ItemType }) @IsEnum(ItemType) itemType: ItemType;
  @ApiProperty() @IsString() itemId: string;
  @ApiProperty({ default: true }) @IsBoolean() @IsOptional() pinned = true;
}
