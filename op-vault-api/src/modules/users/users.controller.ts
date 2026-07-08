import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private users: UsersService) {}

  @Get()
  @Roles(Role.OWNER)
  findAll() {
    return this.users.findAll();
  }

  @Post()
  @Roles(Role.OWNER)
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }
}
