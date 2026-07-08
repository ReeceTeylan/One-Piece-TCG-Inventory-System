import { peso } from '@/lib/utils';
import type { FbCard, FbSet } from './types';

export interface BannerSegment {
  key: string;
  row: number;       // 0-based grid row
  colStart: number;  // 0-based inclusive
  colEnd: number;    // 0-based inclusive
  label: string;
  qty: number;
}

// Split each set's members into contiguous same-row runs so a banner can span them.
// Grouping keeps members contiguous, but a run can still wrap the 5-col grid edge,
// so we emit one segment per row-run.
export function computeSetBanners(cards: FbCard[], sets: FbSet[], cols = 5): BannerSegment[] {
  const indexByKey = new Map(cards.map((c, i) => [c.key, i]));
  const segments: BannerSegment[] = [];

  for (const set of sets) {
    const idxs = set.memberKeys
      .map((k) => indexByKey.get(k))
      .filter((i): i is number => i !== undefined)
      .sort((a, b) => a - b);
    if (!idxs.length) continue;

    const qty = set.quantity ?? 1;
    const parts: string[] = [];
    if (set.price > 0) parts.push(peso(set.price));
    if (set.label?.trim()) parts.push(set.label.trim());
    if (qty > 1) parts.push(`×${qty}`);
    const label = parts.length ? parts.join('  ·  ') : peso(set.price);
    let runStart = idxs[0];
    let prev = idxs[0];

    const flush = (start: number, end: number) => {
      segments.push({
        key: `${set.id}-${start}`,
        row: Math.floor(start / cols),
        colStart: start % cols,
        colEnd: end % cols,
        label,
        qty,
      });
    };

    for (let n = 1; n < idxs.length; n++) {
      const cur = idxs[n];
      const sameRow = Math.floor(cur / cols) === Math.floor(prev / cols);
      if (cur === prev + 1 && sameRow) { prev = cur; continue; }
      flush(runStart, prev);
      runStart = cur; prev = cur;
    }
    flush(runStart, prev);
  }
  return segments;
}

// Reorder so a set's members form one contiguous block at the earliest member's slot.
export function groupContiguous(cards: FbCard[], memberKeys: Set<string>): FbCard[] {
  const members = cards.filter((c) => memberKeys.has(c.key));
  if (members.length < 2) return cards;
  const rest = cards.filter((c) => !memberKeys.has(c.key));
  const prevKeys = cards.map((c) => c.key);
  const firstPos = Math.min(...members.map((m) => prevKeys.indexOf(m.key)));
  const beforeCount = rest.filter((c) => prevKeys.indexOf(c.key) < firstPos).length;
  return [...rest.slice(0, beforeCount), ...members, ...rest.slice(beforeCount)];
}

export function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `set-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
