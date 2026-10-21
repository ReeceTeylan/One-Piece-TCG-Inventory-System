import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsString, Min } from 'class-validator';

export class AdjustStockDto {
  @ApiProperty({ enum: ['RAW', 'SLAB'] })
  @IsIn(['RAW', 'SLAB']) itemType: 'RAW' | 'SLAB';

  @ApiProperty() @IsString() id: string;

  /** The quantity the counter saw on screen. If the DB no longer matches
   *  (e.g. a sale happened mid-count), the adjust is rejected with 409. */
  @ApiProperty() @Type(() => Number) @IsInt() @Min(0) expectedQty: number;

  /** The physically counted quantity — becomes the new stock level. */
  @ApiProperty() @Type(() => Number) @IsInt() @Min(0) countedQty: number;
}
