import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { ActivityLogsService } from './activity-logs.service';
import { QueryActivityLogDto } from './dto/query-activity-log.dto';

@ApiTags('activity-logs')
@ApiBearerAuth()
@Controller('activity-logs')
export class ActivityLogsController {
  constructor(private service: ActivityLogsService) {}

  @Get()
  @Roles(Role.OWNER)
  findAll(@Query() query: QueryActivityLogDto) {
    return this.service.findAll(query);
  }
}
