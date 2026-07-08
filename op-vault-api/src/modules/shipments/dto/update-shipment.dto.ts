import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Courier, ShipStatus } from '@prisma/client';

export class UpdateShipmentDto {
  @ApiPropertyOptional({ enum: ShipStatus }) @IsEnum(ShipStatus) @IsOptional() status?: ShipStatus;
  @ApiPropertyOptional({ enum: Courier }) @IsEnum(Courier) @IsOptional() courier?: Courier;
  @ApiPropertyOptional() @IsString() @IsOptional() trackingNumber?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() note?: string;
}
