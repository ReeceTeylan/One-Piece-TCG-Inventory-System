import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Matches, Min, MaxLength, IsUUID } from 'class-validator';

export class QuickAddDto {
  @IsOptional() @IsUUID('4') requestId?: string;
  @IsString() @Matches(/^[A-Za-z0-9]+-\d{2,3}$/) cardNumber: string;
  @IsIn(['YUYUTEI', 'CARDRUSH', 'TCGPLAYER']) source: 'YUYUTEI' | 'CARDRUSH' | 'TCGPLAYER';
  @IsString() @MaxLength(150) listingKey: string;
  @Type(() => Number) @IsInt() @Min(1) quantity: number;
  @IsOptional() @IsString() @MaxLength(3000) notes?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) buyCost?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) postedPrice?: number;
}
