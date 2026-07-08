import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@ApiTags('settings')
@ApiBearerAuth()
@Controller('settings')
export class SettingsController {
  constructor(private service: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all store settings (with defaults)' })
  getAll() { return this.service.getAll(); }

  @Patch()
  @Roles(Role.OWNER)
  @ApiOperation({ summary: 'Update store settings (Owner only)' })
  update(@Body() dto: UpdateSettingsDto, @CurrentUser('id') userId: string) {
    return this.service.update(dto, userId);
  }
}
