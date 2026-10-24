import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
describe('Refresh token guard', () => {
  it('rejects a disabled account even with a correctly signed token', async () => {
    const users: any = { findById: jest.fn().mockResolvedValue({id:'staff',isActive:false,hashedRefreshToken:'hash'}) };
    const jwt: any = { verifyAsync: jest.fn().mockResolvedValue({sub:'staff'}) };
    const config: any = { get: jest.fn().mockReturnValue('dummy') };
    const svc = new AuthService(users,jwt,config,{} as any,{} as any);
    await expect(svc.refresh('valid-signature')).rejects.toThrow(UnauthorizedException);
  });
});
