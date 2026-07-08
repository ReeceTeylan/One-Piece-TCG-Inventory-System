import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
export class CancelSaleDto {
  @ApiPropertyOptional() @IsString() @IsOptional() reason?: string;
}
