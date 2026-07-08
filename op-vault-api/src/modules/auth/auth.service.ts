import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private users: UsersService,
    private jwt: JwtService,
    private config: ConfigService,
    private notifications: NotificationsService,
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
}
