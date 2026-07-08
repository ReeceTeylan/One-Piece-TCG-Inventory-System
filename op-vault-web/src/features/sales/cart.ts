import type { ItemType } from '@/types';

export interface CartLine {
  key: string;
  itemType: ItemType;
  rawCardId?: string;
  slabId?: string;
  name: string;
  sub: string;
  imageUrl?: string;
  unitPrice: number;
  unitCost: number;
  quantity: number;
  max: number;
}

export const lineTotal = (l: CartLine) => l.unitPrice * l.quantity;
export const lineProfit = (l: CartLine) => (l.unitPrice - l.unitCost) * l.quantity;
export const cartSubtotal = (lines: CartLine[]) => lines.reduce((a, l) => a + lineTotal(l), 0);
export const cartProfit = (lines: CartLine[]) => lines.reduce((a, l) => a + lineProfit(l), 0);
