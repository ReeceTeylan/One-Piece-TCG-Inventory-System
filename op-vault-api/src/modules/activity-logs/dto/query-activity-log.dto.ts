import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryActivityLogDto extends PaginationDto {
  @ApiPropertyOptional() @IsString() @IsOptional() action?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() entityType?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() userId?: string;
}
