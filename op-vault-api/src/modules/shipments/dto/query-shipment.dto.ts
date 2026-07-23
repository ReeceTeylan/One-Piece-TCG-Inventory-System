import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { Courier, ShipStatus } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryShipmentDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ShipStatus }) @IsEnum(ShipStatus) @IsOptional() status?: ShipStatus;
  @ApiPropertyOptional({ enum: Courier }) @IsEnum(Courier) @IsOptional() courier?: Courier;
  @ApiPropertyOptional({ description: 'Only shipments needing action (To Pack or Ready)' })
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean() @IsOptional() pending?: boolean;
}
