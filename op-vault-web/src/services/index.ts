import { api, unwrap, Paginated } from '@/lib/api';
import type {
  RawCard, SlabCard, Customer, Sale, Payment, Shipment, Notification,
  DashboardData, TrendPoint, Settings, CardImage, Promo,
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
  // Sealed products only — backend rejects graded slabs with SLAB_NOT_STACKABLE.
  restock: (id: string, dto: { quantityAdded: number; buyCost: number }) =>
    api.post(`/slabs/${id}/restock`, dto).then(unwrap<SlabCard>),
  remove: (id: string) => api.delete(`/slabs/${id}`).then(unwrap),
};
export const stockCountService = {
  // Sets an item to its counted quantity; 409 STOCK_CHANGED if it moved since loaded.
  adjust: (dto: { itemType: 'RAW' | 'SLAB'; id: string; expectedQty: number; countedQty: number }) =>
    api.post('/stock-count/adjust', dto).then(unwrap<{ changed: boolean; quantity: number; delta: number }>),
};
// Market prices: Yuyu-tei (yen) for Japanese cards, TCGplayer via TCGCSV (USD) for
// English ones. Peso conversion and Match prices are worked out server-side.
export type MarketSource = 'YUYUTEI' | 'TCGPLAYER';
export type MarketSort = 'change' | 'price_desc' | 'price_asc' | 'recent' | 'margin_desc' | 'underpriced';
export interface MarketListing {
  source: MarketSource; listingKey: string; name: string; rarity: string | null;
  price: number; currency: 'JPY' | 'USD'; inStock: boolean | null; stockCount: number | null;
  url: string; fetchedAt: string; manual: boolean; viaLink: boolean;
  prevPrice: number | null; priceChangedAt: string | null;
}
export interface MarketCandidate {
  source: MarketSource; listingKey: string; cardNumber: string; name: string; rarity: string | null;
  setLabel: string; price: number; currency: 'JPY' | 'USD'; inStock: boolean | null; stockCount: number | null; url: string;
}
export interface MarketSync {
  running: boolean; trigger: 'nightly' | 'manual' | null; phase: 'yuyutei' | 'tcgplayer' | null;
  total: number; done: number; failed: number; empty: number;
  startedAt: string | null; finishedAt: string | null; lastError: string | null;
}
export interface MarketRow {
  id: string; name: string; cardNumber: string; rarity: string; setName: string; quantity: number;
  postedPrice: number; buyCost: number; createdAt: string; imageUrl: string | null; notes: string | null;
  condition: 'clean' | 'issues'; changePhp: number | null; marginPct: number | null;
  language: 'JP' | 'EN'; damage: string | null; rateUsed: number | null; damagedRateMissing: boolean;
  listing: MarketListing | null; candidateCount: number;
  marketPhp: number | null; diffPct: number | null; underpriced: boolean; matchPrice: number | null;
}
export interface MarketSummary {
  rate: number | null; usdRate: number | null; jpyDamagedRate: number | null; usdDamagedRate: number | null;
  pct: number; cards: number; matched: number; underpriced: number; matchableUnderpriced: number;
  changed: number; view: 'changes' | 'all';
  lastRun: MarketSync | null; sync: MarketSync;
}
export interface MarketMover {
  id: string; name: string; cardNumber: string; rarity: string; imageUrl: string | null; language: 'JP' | 'EN';
  postedPrice: number; marketPhp: number | null; changePhp: number | null; changePct: number | null; priceChangedAt: string | null;
}
export interface CardMarket {
  marketPhp: number | null; matchPrice: number | null; diffPct: number | null; underpriced: boolean;
  changePhp: number | null; language: 'JP' | 'EN'; source: MarketSource | null; listingName: string | null;
}
export interface PriceSuggestion {
  cardNumber: string; rarity: string; language: 'JP' | 'EN'; damage: string | null;
  found: boolean; reason: string | null; candidates: number;
  source: MarketSource | null; listingName: string | null; price: number | null; currency: 'JPY' | 'USD' | null;
  rate: number | null; marketPhp: number | null; suggested: number | null; url: string | null; fetchedAt: string | null;
}
export const marketPricesService = {
  list: (p?: Record<string, any>) =>
    api.get('/market-prices', { params: p }).then((r) => unwrap<Omit<Paginated<MarketRow>, 'summary'> & { summary: MarketSummary }>(r)),
  status: () => one<MarketSync>('/market-prices/sync/status'),
  sync: () => api.post('/market-prices/sync').then(unwrap<MarketSync>),
  listings: (cardNumber: string, source: MarketSource) =>
    api.get(`/market-prices/listings/${encodeURIComponent(cardNumber)}`, { params: { source } }).then(unwrap<MarketCandidate[]>),
  link: (id: string, listingKey: string | null) =>
    api.patch(`/market-prices/raw-cards/${id}/link`, { listingKey }).then(unwrap),
  // Match by pasting a Yuyu-tei card page link (for cards search can't find, e.g. DON!!).
  linkUrl: (id: string, url: string) =>
    api.patch(`/market-prices/raw-cards/${id}/link-url`, { url }).then(unwrap<{ name: string }>),
  // Set posted price to the rounded market price; bulk version only raises underpriced cards.
  match: (id: string) =>
    api.post(`/market-prices/raw-cards/${id}/match`).then(unwrap<{ id: string; from: number; to: number; changed: boolean }>),
  // Dashboard "Market movers": biggest price changes since the last sync.
  movers: (limit = 5) => api.get('/market-prices/movers', { params: { limit } }).then(unwrap<{ changed: number; data: MarketMover[] }>),
  // Market price for specific raw cards (Raw Cards page, Sales wizard). Cards with no stock aren't priced.
  forCards: (ids: string[]) =>
    api.get('/market-prices/cards', { params: { ids: ids.join(',') } }).then(unwrap<Record<string, CardMarket>>),
  // Add Card form: suggested posted price for a card number + rarity (notes decide English / damaged).
  suggest: (p: { cardNumber: string; rarity: string; notes?: string }) =>
    api.get('/market-prices/suggest', { params: p }).then(unwrap<PriceSuggestion>),
  matchAllUnderpriced: () =>
    api.post('/market-prices/match-underpriced').then(unwrap<{ updated: number; changes: { id: string; name: string; from: number; to: number }[] }>),
};
export const customersService = {
  list: (p?: Record<string, any>) => list<Customer>('/customers', p),
  get: (id: string) => one<Customer>(`/customers/${id}`),
  purchases: (id: string) => one<Sale[]>(`/customers/${id}/purchases`),
  statistics: (id: string) => one<any>(`/customers/${id}/statistics`),
  create: (dto: any) => api.post('/customers', dto).then(unwrap<Customer>),
  update: (id: string, dto: any) => api.patch(`/customers/${id}`, dto).then(unwrap<Customer>),
  remove: (id: string) => api.delete(`/customers/${id}`).then(unwrap),
  duplicates: () => api.get('/customers/duplicates').then(unwrap<any[]>),
  merge: (keepId: string, mergeIds: string[]) => api.post('/customers/merge', { keepId, mergeIds }).then(unwrap),
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
  // GCash / Maya QR printed on sale receipts.
  uploadQr: (method: 'gcash' | 'maya', file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post(`/images/payment-qr/${method}`, fd).then(unwrap<{ method: string; url: string }>);
  },
  removeQr: (method: 'gcash' | 'maya') => api.delete(`/images/payment-qr/${method}`).then(unwrap),
};
export const promosService = {
  active: () => one<Promo | null>('/promos/active'),
  history: () => one<Promo[]>('/promos/history'),
  create: (dto: { percentage: number; durationHours: number; note?: string }) =>
    api.post('/promos', dto).then(unwrap<Promo>),
  end: () => api.patch('/promos/end').then(unwrap<Promo>),
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
};
export const authService = {
  changePassword: (dto: { currentPassword: string; newPassword: string }) =>
    api.patch('/auth/change-password', dto).then(unwrap<{ message: string }>),
}