import { api, unwrap, Paginated } from '@/lib/api';
import type {
  RawCard, SlabCard, Customer, Sale, Payment, Shipment, Notification,
  DashboardData, TrendPoint, Settings, CardImage,
} from '@/types';

const list = <T,>(url: string, params?: Record<string, any>) =>
  api.get(url, { params }).then((r) => unwrap<Paginated<T>>(r));
const one = <T,>(url: string) => api.get(url).then((r) => unwrap<T>(r));

export const rawCardsService = {
  list: (p?: Record<string, any>) => list<RawCard>('/raw-cards', p),
  get: (id: string) => one<RawCard>(`/raw-cards/${id}`),
  create: (dto: any) => api.post('/raw-cards', dto).then(unwrap<RawCard>),
  import: (rows: any[]) => api.post('/raw-cards/import', { rows }).then(unwrap<{ total: number; created: number; restocked: number; errors: { row: number; reason: string }[] }>),
  addQuantity: (id: string, quantity: number) => api.post(`/raw-cards/${id}/add-quantity`, { quantity }).then(unwrap<RawCard>),
  restock: (id: string, dto: any) => api.post(`/raw-cards/${id}/restock`, dto).then(unwrap<RawCard>),
  update: (id: string, dto: any) => api.patch(`/raw-cards/${id}`, dto).then(unwrap<RawCard>),
  remove: (id: string) => api.delete(`/raw-cards/${id}`).then(unwrap<{ message: string }>),
};
export const slabsService = {
  list: (p?: Record<string, any>) => list<SlabCard>('/slabs', p),
  get: (id: string) => one<SlabCard>(`/slabs/${id}`),
  create: (dto: any) => api.post('/slabs', dto).then(unwrap<SlabCard>),
  update: (id: string, dto: any) => api.patch(`/slabs/${id}`, dto).then(unwrap<SlabCard>),
  remove: (id: string) => api.delete(`/slabs/${id}`).then(unwrap),
};
export const customersService = {
  list: (p?: Record<string, any>) => list<Customer>('/customers', p),
  get: (id: string) => one<Customer>(`/customers/${id}`),
  purchases: (id: string) => one<Sale[]>(`/customers/${id}/purchases`),
  statistics: (id: string) => one<any>(`/customers/${id}/statistics`),
  create: (dto: any) => api.post('/customers', dto).then(unwrap<Customer>),
  update: (id: string, dto: any) => api.patch(`/customers/${id}`, dto).then(unwrap<Customer>),
  remove: (id: string) => api.delete(`/customers/${id}`).then(unwrap),
};
export const salesService = {
  list: (p?: Record<string, any>) => list<Sale>('/sales', p),
  get: (id: string) => one<Sale>(`/sales/${id}`),
  complete: (dto: any) => api.post('/sales', dto).then(unwrap<Sale>),
  editItems: (id: string, dto: any) => api.patch(`/sales/${id}/items`, dto).then(unwrap<Sale>),
  cancel: (id: string, reason?: string) => api.post(`/sales/${id}/cancel`, { reason }).then(unwrap),
  refund: (id: string, reason?: string) => api.post(`/sales/${id}/refund`, { reason }).then(unwrap),
  undo: (id: string) => api.post(`/sales/${id}/undo`).then(unwrap),
};
export const paymentsService = {
  forSale: (saleId: string) => one<{ grandTotal: number; amountPaid: number; remainingBalance: number; status: string; payments: Payment[] }>(`/sales/${saleId}/payments`),
  add: (saleId: string, dto: any) => api.post(`/sales/${saleId}/payments`, dto).then(unwrap),
};
export const shipmentsService = {
  list: (p?: Record<string, any>) => list<Shipment>('/shipments', p),
  get: (id: string) => one<Shipment>(`/shipments/${id}`),
  timeline: (id: string) => one<any[]>(`/shipments/${id}/timeline`),
  update: (id: string, dto: any) => api.patch(`/shipments/${id}`, dto).then(unwrap<Shipment>),
};
export const analyticsService = {
  dashboard: () => one<DashboardData>('/analytics/dashboard'),
  trends: (p?: Record<string, any>) => api.get('/analytics/trends', { params: p }).then((r) => unwrap<TrendPoint[]>(r)),
  inventory: () => one<any>('/analytics/inventory'),
  cards: (p?: Record<string, any>) => api.get('/analytics/cards', { params: p }).then((r) => unwrap<any>(r)),
  slabs: () => one<any>('/analytics/slabs'),
  customers: (p?: Record<string, any>) => api.get('/analytics/customers', { params: p }).then((r) => unwrap<any>(r)),
};
export const notificationsService = {
  list: (p?: Record<string, any>) => list<Notification>('/notifications', p),
  unreadCount: () => one<{ unread: number }>('/notifications/unread-count'),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`).then(unwrap),
  markAllRead: () => api.patch('/notifications/read-all').then(unwrap),
  dismiss: (id: string) => api.delete(`/notifications/${id}`).then(unwrap),
};
export const settingsService = {
  get: () => one<Settings>('/settings'),
  update: (dto: Partial<Settings>) => api.patch('/settings', dto).then(unwrap<Settings>),
};
export const favoritesService = {
  list: () => one<any[]>('/favorites'),
  pinned: () => one<{ rawCards: RawCard[]; slabs: SlabCard[] }>('/favorites/pinned'),
  toggle: (itemType: string, itemId: string) => api.post('/favorites/toggle', { itemType, itemId }).then(unwrap),
  pin: (itemType: string, itemId: string, pinned: boolean) => api.post('/favorites/pin', { itemType, itemId, pinned }).then(unwrap),
};
export const imagesService = {
  upload: (file: File, itemType: string, itemId: string, onProgress?: (pct: number) => void) => {
    const fd = new FormData();
    fd.append('file', file); fd.append('itemType', itemType); fd.append('itemId', itemId);
    return api
      .post('/images', fd, {
        onUploadProgress: (e) => {
          if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
        },
      })
      .then(unwrap<CardImage>);
  },
  remove: (id: string) => api.delete(`/images/${id}`).then(unwrap),
};
export const activityLogsService = {
  list: (p?: Record<string, any>) => list<any>('/activity-logs', p),
};
export const reportsService = {
  download: async (type: string) => {
    const res = await api.get(`/reports/${type}/pdf`, { responseType: 'blob' });
    triggerDownload(res.data, `${type}-report.pdf`);
  },
};
export const facebookService = {
  generate: async (opts: any) => {
    const res = await api.post('/facebook/generate', opts, { responseType: 'blob' });
    return res.data as Blob;
  },
};
export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  a.remove(); URL.revokeObjectURL(url);
}
