import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { NotifType } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryNotificationDto extends PaginationDto {
  @ApiPropertyOptional({ enum: NotifType }) @IsEnum(NotifType) @IsOptional() type?: NotifType;
  @ApiPropertyOptional() @IsOptional()
  @Transform(({ value }) => (value === 'true' || value === true))
  @IsBoolean() isRead?: boolean;
}
