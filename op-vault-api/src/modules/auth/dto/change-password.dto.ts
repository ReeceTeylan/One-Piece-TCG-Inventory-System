import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty()
  @IsString() currentPassword: string;

  @ApiProperty({ description: 'At least 8 characters' })
  @IsString() @MinLength(8) newPassword: string;
}