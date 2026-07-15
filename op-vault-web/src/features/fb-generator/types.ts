import type { RawCard, SlabCard } from '@/types';

export type OverlayTheme = 'dark' | 'light';
export type TextPosition = 'pill' | 'bottom' | 'top' | 'bottom-split';
export type BadgeState = 'none' | 'reserved' | 'sold';

export interface OverlayConfig {
  showPrice: boolean;
  showQuantity: boolean;
  showCardNumber: boolean;
  showLogo: boolean;
  showNotes: boolean;
  theme: OverlayTheme;
  opacity: number;      // 0..1
  fontSize: number;     // px at base scale
  borderRadius: number; // px
  shadow: boolean;
  textPosition: TextPosition;
}

export interface FbCard {
  key: string;
  id: string;
  itemType: 'RAW' | 'SLAB' | 'SEALED';
  name: string;
  cardNumber: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  grade?: string;
  note?: string;
  badge: BadgeState;
}

export interface FbSet {
  id: string;
  price: number;
  label?: string;      // optional custom label; falls back to formatted price
  quantity: number;    // number of identical grouped sets (e.g. 3x the same set)
  memberKeys: string[];
}

export const DEFAULT_CONFIG: OverlayConfig = {
  showPrice: true,
  showQuantity: true,
  showCardNumber: false,
  showLogo: true,
  showNotes: true,
  theme: 'dark',
  opacity: 0.85,
  fontSize: 15,
  borderRadius: 5,
  shadow: true,
  textPosition: 'pill',
};

export type GenType = 'RAW' | 'SLAB' | 'SEALED';

export interface GenMode {
  type: GenType;
  label: string;
  cols: number;
  rows: number;
  perPage: number;
  aspectW: number;  // tile aspect width
  aspectH: number;  // tile aspect height
}

export const MODES: Record<GenType, GenMode> = {
  RAW:    { type: 'RAW',    label: 'Raw Cards',       cols: 5, rows: 4, perPage: 20, aspectW: 5,  aspectH: 7  },
  SLAB:   { type: 'SLAB',   label: 'Slabs',           cols: 4, rows: 3, perPage: 12, aspectW: 68, aspectH: 97 },
  SEALED: { type: 'SEALED', label: 'Sealed Products', cols: 5, rows: 4, perPage: 20, aspectW: 5,  aspectH: 7  },
};

export const RESOLUTIONS = [
  { label: '1080p', width: 1080 },
  { label: '1440p', width: 1440 },
  { label: '4K', width: 2160 },
] as const;

export function toFbCard(item: RawCard | SlabCard, itemType: 'RAW' | 'SLAB'): FbCard {
  if (itemType === 'RAW') {
    const c = item as RawCard;
    return {
      key: `raw-${c.id}`, id: c.id, itemType, name: c.name, cardNumber: c.cardNumber,
      price: Number(c.postedPrice), quantity: c.quantity, imageUrl: c.images?.[0]?.url, note: c.notes ?? undefined, badge: 'none',
    };
  }
  const s = item as SlabCard;
  return {
    key: `slab-${s.id}`, id: s.id, itemType, name: s.name, cardNumber: s.slabNumber,
    price: Number(s.sellPrice), quantity: 1, imageUrl: s.images?.[0]?.url,
    grade: `${s.gradingCompany} ${Number(s.grade)}`, note: s.notes ?? undefined, badge: 'none',
  };
}
