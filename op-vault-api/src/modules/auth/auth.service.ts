import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private users: UsersService,
    private jwt: JwtService,
    private config: ConfigService,
    private notifications: NotificationsService,
    private prisma: PrismaService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.users.findByEmail(email);
    if (!user || !(await bcrypt.compare(password, user.password))) {
      await this.notifications.emit({ type: 'SYSTEM', title: 'Failed login attempt', body: `Email: ${email}` });
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!user.isActive) throw new UnauthorizedException('Account is disabled');
    return user;
  }

  private async issueTokens(user: { id: string; email: string; role: string }) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get('jwt.accessSecret'),
      expiresIn: this.config.get('jwt.accessTtl'),
    });
    const refreshToken = await this.jwt.signAsync(payload, {
      secret: this.config.get('jwt.refreshSecret'),
      expiresIn: this.config.get('jwt.refreshTtl'),
    });
    await this.users.setRefreshToken(user.id, refreshToken);
    return { accessToken, refreshToken };
  }

  async login(dto: LoginDto) {
    const user = await this.validateUser(dto.email, dto.password);
    const tokens = await this.issueTokens(user);
    return { ...tokens, user: this.users.sanitize(user) };
  }

  async refresh(refreshToken: string) {
    let payload: any;
    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.config.get('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const user = await this.users.findById(payload.sub);
    if (!user.hashedRefreshToken || !(await bcrypt.compare(refreshToken, user.hashedRefreshToken))) {
      throw new UnauthorizedException('Refresh token revoked');
    }
    const tokens = await this.issueTokens(user);
    return { ...tokens, user: this.users.sanitize(user) };
  }

  async logout(userId: string) {
    await this.users.setRefreshToken(userId, null);
    return { message: 'Logged out' };
  }
  
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException('User not found');

    const ok = await bcrypt.compare(currentPassword, user.password);
    if (!ok) throw new UnauthorizedException('Current password is incorrect');

    const sameAsOld = await bcrypt.compare(newPassword, user.password);
    if (sameAsOld) throw new BadRequestException('New password must be different from the current one');

    const hashed = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashed, hashedRefreshToken: null }, // revoke sessions
    });

    return { message: 'Password changed successfully' };
  }
}
