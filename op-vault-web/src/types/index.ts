export type Role = 'OWNER' | 'STAFF';
export type ItemType = 'RAW' | 'SLAB';
export type StockStatus = 'AVAILABLE' | 'LOW' | 'OUT' | 'SOLD';
export type SaleStatus = 'PAID' | 'PARTIAL' | 'UNPAID' | 'CANCELLED' | 'REFUNDED';
export type ShipStatus = 'TO_PACK' | 'READY' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
export type Courier = 'LBC' | 'JNT' | 'LALAMOVE' | 'MEETUP' | 'OTHER';
export type PaymentMethod = 'CASH' | 'GCASH' | 'BANK_TRANSFER' | 'MAYA' | 'OTHER';
export type NotifType = 'LOW_STOCK' | 'OUT_OF_STOCK' | 'SALE' | 'SHIPMENT' | 'SYSTEM';

export interface User { id: string; email: string; fullName: string; role: Role; isActive?: boolean; }
export interface CardImage { id: string; url: string; storageKey: string; isPrimary: boolean; thumbnailUrl?: string; }

export interface RawCard {
  id: string; name: string; cardNumber: string; setName: string; character?: string; color?: string;
  rarity: string; quantity: number; buyCost: string; postedPrice: string; avgSellPrice?: string;
  status: StockStatus; notes?: string; isPinned: boolean; totalSold: number; lastSoldAt?: string;
  images?: CardImage[]; createdAt: string; updatedAt: string;
}
export interface SlabCard {
  id: string; name: string; cardNumber?: string; setName?: string; character?: string; rarity?: string;
  gradingCompany: string; slabNumber: string; grade: string; buyCost: string; sellPrice: string;
  status: StockStatus; notes?: string; isPinned: boolean; images?: CardImage[]; createdAt: string;
}
export interface Customer {
  id: string; name: string; facebookName?: string; contactNumber?: string; notes?: string;
  createdAt: string; _count?: { sales: number };
}
export interface SaleItem {
  id: string; itemType: ItemType; rawCardId?: string; slabId?: string; nameSnapshot: string;
  quantity: number; unitPrice: string; unitCost: string; lineProfit: string;
}
export interface Sale {
  id: string; reference: string; customerId: string; subtotal: string; discount: string;
  shippingFee: string; grandTotal: string; amountPaid: string; totalProfit: string; status: SaleStatus;
  notes?: string; createdAt: string; items?: SaleItem[]; customer?: { name: string };
  shipment?: { status: ShipStatus; courier: Courier; trackingNumber?: string };
}
export interface Payment { id: string; saleId: string; amount: string; method: PaymentMethod; note?: string; createdAt: string; }
export interface Shipment {
  id: string; saleId: string; courier: Courier; status: ShipStatus; shippingFee: string;
  totalValue: string; trackingNumber?: string; dateShipped?: string; createdAt: string;
  items?: { id: string; nameSnapshot: string; quantity: number }[];
  events?: { id: string; status: ShipStatus; note?: string; createdAt: string }[];
  sale?: { reference: string; customer: { name: string } };
}
export interface Notification { id: string; type: NotifType; title: string; body?: string; isRead: boolean; createdAt: string; }
export interface DashboardData {
  revenue: Record<'today' | 'week' | 'month' | 'year', number>;
  profit: Record<'today' | 'week' | 'month' | 'year', number>;
  cardsSold: Record<'today' | 'week' | 'month' | 'year', number>;
  orders: Record<'today' | 'week' | 'month' | 'year', number>;
  growth: { revenueWeek: number; revenueMonth: number; profitMonth: number };
  inventory: { inventoryValue: number; averageBuyingCost: number; averageSellingPrice: number; profitMargin: number; lowStockCount: number; deadStockCount: number };
  counts: { totalRawCards: number; totalSlabs: number; waitingToShip: number };
  generatedAt: string;
}
export interface TrendPoint { date: string; revenue: number; profit: number; orders: number; cardsSold: number; }
export interface Settings { storeName: string; logoUrl: string | null; currency: string; defaultShippingFee: number; lowStockThreshold: number; postedPriceFormula: string; }
