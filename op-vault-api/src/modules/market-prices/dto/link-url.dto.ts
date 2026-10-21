import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class LinkUrlDto {
  @ApiProperty({ example: 'https://yuyu-tei.jp/sell/opc/card/prb02/10217' })
  @IsString() @MaxLength(300) url: string;
}
