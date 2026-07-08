import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsPositive } from 'class-validator';

export class AddQuantityDto {
  @ApiProperty() @Type(() => Number) @IsInt() @IsPositive() quantity: number;
}
