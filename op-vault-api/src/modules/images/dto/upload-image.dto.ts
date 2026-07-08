import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString } from 'class-validator';
import { ItemType } from '@prisma/client';

export class UploadImageDto {
  @ApiProperty({ enum: ItemType }) @IsEnum(ItemType) itemType: ItemType;
  @ApiProperty() @IsString() itemId: string;
}
