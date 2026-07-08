import { Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    const password = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({ data: { ...dto, password } });
    return this.sanitize(user);
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findAll() {
    const users = await this.prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
    return users.map((u) => this.sanitize(u));
  }

  async setRefreshToken(userId: string, token: string | null) {
    const hashedRefreshToken = token ? await bcrypt.hash(token, 10) : null;
    await this.prisma.user.update({ where: { id: userId }, data: { hashedRefreshToken } });
  }

  sanitize(user: any) {
    const { password, hashedRefreshToken, ...rest } = user;
    return rest;
  }
}
