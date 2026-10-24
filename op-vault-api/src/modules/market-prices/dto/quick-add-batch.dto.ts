import { Type } from 'class-transformer';
import { IsArray, ArrayMaxSize, ArrayMinSize, ValidateNested, IsOptional, IsString, MaxLength, Matches } from 'class-validator';
import { QuickAddDto } from './quick-add.dto';

export class QueuedQuickAddItemDto extends QuickAddDto {
  @IsOptional() @IsString() @MaxLength(160) englishName?: string;
  @IsOptional() @IsString() @MaxLength(160) englishCharacter?: string;
}

export class QuickAddBatchDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(40) @ValidateNested({ each: true })
  @Type(() => QueuedQuickAddItemDto)
  items: QueuedQuickAddItemDto[];
}
