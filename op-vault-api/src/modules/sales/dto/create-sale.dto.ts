import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize, IsArray, IsEnum, IsNumber, IsOptional, IsString, Min, ValidateNested,
} from 'class-validator';
import { Courier, ItemType, PaymentMethod } from '@prisma/client';
import { CreateCustomerDto } from '../../customers/dto/create-customer.dto';

export class SaleItemInput {
  @ApiProperty({ enum: ItemType }) @IsEnum(ItemType) itemType: ItemType;
  @ApiPropertyOptional() @IsString() @IsOptional() rawCardId?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() slabId?: string;
  @ApiProperty({ default: 1 }) @Type(() => Number) @IsNumber() @Min(1) quantity: number;
  @ApiProperty({ description: 'Editable unit selling price' })
  @Type(() => Number) @IsNumber() @Min(0) unitPrice: number;
}

export class CreateSaleDto {
  @ApiPropertyOptional({ description: 'Existing customer id (or provide `customer`)' })
  @IsString() @IsOptional() customerId?: string;

  @ApiPropertyOptional({ type: CreateCustomerDto, description: 'New customer to create in-transaction' })
  @ValidateNested() @Type(() => CreateCustomerDto) @IsOptional() customer?: CreateCustomerDto;

  @ApiProperty({ type: [SaleItemInput] })
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => SaleItemInput)
  items: SaleItemInput[];

  @ApiPropertyOptional({ default: 0 }) @Type(() => Number) @IsNumber() @Min(0) @IsOptional() discount = 0;
  @ApiPropertyOptional({ default: 0 }) @Type(() => Number) @IsNumber() @Min(0) @IsOptional() shippingFee = 0;
  @ApiProperty({ enum: Courier }) @IsEnum(Courier) courier: Courier;

  @ApiPropertyOptional({ default: 0, description: 'Amount paid now' })
  @Type(() => Number) @IsNumber() @Min(0) @IsOptional() amountPaid = 0;
  @ApiPropertyOptional({ enum: PaymentMethod, default: PaymentMethod.CASH })
  @IsEnum(PaymentMethod) @IsOptional() paymentMethod: PaymentMethod = PaymentMethod.CASH;

  @ApiPropertyOptional() @IsString() @IsOptional() notes?: string;
}
