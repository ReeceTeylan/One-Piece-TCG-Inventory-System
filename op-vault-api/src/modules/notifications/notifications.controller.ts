import { Controller, Delete, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';
import { QueryNotificationDto } from './dto/query-notification.dto';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private service: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List notifications for the current user' })
  findAll(@Query() query: QueryNotificationDto, @CurrentUser('id') userId: string) {
    return this.service.findAll(query, userId);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Count unread notifications' })
  unread(@CurrentUser('id') userId: string) { return this.service.unreadCount(userId); }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  readAll(@CurrentUser('id') userId: string) { return this.service.markAllRead(userId); }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark one notification as read' })
  read(@Param('id') id: string) { return this.service.markRead(id); }

  @Delete(':id')
  @ApiOperation({ summary: 'Dismiss (delete) a notification' })
  dismiss(@Param('id') id: string) { return this.service.dismiss(id); }
}
