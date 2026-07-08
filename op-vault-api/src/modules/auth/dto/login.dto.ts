import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'owner@opvault.ph' }) @IsEmail() email: string;
  @ApiProperty({ example: 'Owner@123' }) @IsString() @IsNotEmpty() password: string;
}
