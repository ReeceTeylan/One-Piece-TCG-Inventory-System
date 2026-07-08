import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class CreatePaymentDto {
  @ApiProperty() @Type(() => Number) @IsNumber() @IsPositive() amount: number;
  @ApiPropertyOptional({ enum: PaymentMethod, default: PaymentMethod.CASH })
  @IsEnum(PaymentMethod) @IsOptional() method: PaymentMethod = PaymentMethod.CASH;
  @ApiPropertyOptional() @IsString() @IsOptional() note?: string;
}
