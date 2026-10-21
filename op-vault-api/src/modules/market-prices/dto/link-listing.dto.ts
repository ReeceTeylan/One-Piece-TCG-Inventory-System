import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class LinkListingDto {
  /** Yuyu-tei listing key ("op01/10151"), or null to return to automatic matching. */
  @ApiProperty({ nullable: true, example: 'op01/10151' })
  @IsString() @IsOptional() listingKey: string | null;
}
