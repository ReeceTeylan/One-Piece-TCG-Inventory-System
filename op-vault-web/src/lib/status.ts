import type { StockStatus, SaleStatus, ShipStatus } from '@/types';

export const stockVariant = (s: StockStatus) =>
  s === 'AVAILABLE' ? 'success' : s === 'LOW' ? 'warning' : 'destructive';
export const stockLabel = (s: StockStatus) =>
  s === 'AVAILABLE' ? 'Available' : s === 'LOW' ? 'Low' : s === 'OUT' ? 'Out' : 'Sold';

export const saleVariant = (s: SaleStatus) =>
  s === 'PAID' ? 'success' : s === 'PARTIAL' ? 'warning' : s === 'UNPAID' ? 'default' : 'destructive';

export const shipVariant = (s: ShipStatus) =>
  s === 'DELIVERED' ? 'success' : s === 'SHIPPED' ? 'info' : s === 'READY' ? 'warning' : s === 'CANCELLED' ? 'destructive' : 'default';
export const shipLabel = (s: ShipStatus) =>
  ({ TO_PACK: 'To Pack', READY: 'Ready', SHIPPED: 'Shipped', DELIVERED: 'Delivered', CANCELLED: 'Cancelled' }[s]);

export const COURIERS: { value: string; label: string }[] = [
  { value: 'MEETUP', label: 'Meet-up' }, { value: 'LBC', label: 'LBC' },
  { value: 'JNT', label: 'J&T Express' }, { value: 'LALAMOVE', label: 'Lalamove' }, { value: 'OTHER', label: 'Other' },
];
export const PAYMENT_METHODS = ['CASH', 'GCASH', 'BANK_TRANSFER', 'MAYA', 'OTHER'];
