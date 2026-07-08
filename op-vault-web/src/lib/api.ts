import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const BASE = import.meta.env.VITE_API_URL || '/api';

export const tokenStore = {
  get access() { return sessionStorage.getItem('op_access'); },
  get refresh() { return localStorage.getItem('op_refresh'); },
  set(access: string | null, refresh?: string | null) {
    if (access) sessionStorage.setItem('op_access', access); else sessionStorage.removeItem('op_access');
    if (refresh !== undefined) {
      if (refresh) localStorage.setItem('op_refresh', refresh); else localStorage.removeItem('op_refresh');
    }
  },
  clear() { sessionStorage.removeItem('op_access'); localStorage.removeItem('op_refresh'); },
};

export const api = axios.create({ baseURL: BASE });

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const t = tokenStore.access;
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

let refreshing: Promise<string | null> | null = null;
async function doRefresh(): Promise<string | null> {
  const refreshToken = tokenStore.refresh;
  if (!refreshToken) return null;
  try {
    const { data } = await axios.post(`${BASE}/auth/refresh`, { refreshToken });
    const payload = data.data ?? data;
    tokenStore.set(payload.accessToken, payload.refreshToken);
    return payload.accessToken;
  } catch {
    tokenStore.clear();
    return null;
  }
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true;
      refreshing = refreshing ?? doRefresh();
      const newToken = await refreshing;
      refreshing = null;
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      }
      if (location.pathname !== '/login') location.assign('/login');
    }
    return Promise.reject(error);
  },
);

// Unwrap backend envelopes: { success, data } -> data ; { data, meta } -> kept.
export function unwrap<T>(res: { data: any }): T {
  const body = res.data;
  if (body && body.meta && body.data !== undefined) return body as T; // paginated
  return (body?.data !== undefined ? body.data : body) as T;
}

export interface Paginated<T> { data: T[]; meta: { total: number; page: number; limit: number; totalPages: number }; }
export function apiError(e: unknown): { code?: string; message: string; status?: number; body?: any } {
  const err = e as AxiosError<any>;
  return {
    status: err.response?.status,
    code: err.response?.data?.code,
    message: err.response?.data?.message || err.message || 'Request failed',
    body: err.response?.data,
  };
}
