import { api, tokenStore, unwrap } from '@/lib/api';
import type { User } from '@/types';

export const authService = {
  async login(email: string, password: string) {
    const res = await api.post('/auth/login', { email, password });
    const data = unwrap<{ accessToken: string; refreshToken: string; user: User }>(res);
    tokenStore.set(data.accessToken, data.refreshToken);
    return data.user;
  },
  async me() { return unwrap<User>(await api.get('/auth/me')); },
  async logout() { try { await api.post('/auth/logout'); } finally { tokenStore.clear(); } },
};
