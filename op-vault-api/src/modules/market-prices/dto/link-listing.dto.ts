import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class LinkListingDto {
  /** Listing key ("op01/10151", "dorasuta:413585", "tcgp:…"), "none" for no market price, or null for automatic. */
  @ApiProperty({ nullable: true, example: 'op01/10151' })
  @IsString() @IsOptional() listingKey: string | null;
}
