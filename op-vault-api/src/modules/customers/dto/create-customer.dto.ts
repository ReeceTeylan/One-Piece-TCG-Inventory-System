import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCustomerDto {
  @ApiProperty() @IsString() @IsNotEmpty() name: string;
  @ApiPropertyOptional() @IsString() @IsOptional() facebookName?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() contactNumber?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() notes?: string;
}
