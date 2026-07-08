import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { Role } from '@prisma/client';

export class CreateUserDto {
  @ApiProperty() @IsEmail() email: string;
  @ApiProperty({ minLength: 8 }) @IsString() @MinLength(8) password: string;
  @ApiProperty() @IsNotEmpty() @IsString() fullName: string;
  @ApiProperty({ enum: Role, default: Role.STAFF }) @IsEnum(Role) role: Role = Role.STAFF;
}
