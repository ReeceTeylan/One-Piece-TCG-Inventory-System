import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { Courier, ShipStatus } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryShipmentDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ShipStatus }) @IsEnum(ShipStatus) @IsOptional() status?: ShipStatus;
  @ApiPropertyOptional({ enum: Courier }) @IsEnum(Courier) @IsOptional() courier?: Courier;
}
