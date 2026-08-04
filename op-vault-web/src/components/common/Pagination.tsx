import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export const PAGE_SIZES = [15, 25, 50, 100, 200];

export function Pagination({ page, totalPages, total, onPage, limit, onLimit }: {
  page: number; totalPages: number; total: number; onPage: (p: number) => void;
  // Optional: pages that don't offer a size picker simply omit these.
  limit?: number; onLimit?: (n: number) => void;
}) {
  return (
    <div className="flex flex-1 items-center justify-between gap-2 px-4 py-3 text-sm text-muted-foreground">
      <span className="min-w-0 truncate">{total} total · page {page} of {totalPages}</span>
      <div className="flex shrink-0 items-center gap-1.5">
        {limit !== undefined && onLimit && (
          <Select value={String(limit)} onChange={(e) => onLimit(Number(e.target.value))}
            className="mr-1 hidden h-8 w-[76px] text-xs sm:block" aria-label="Items per page">
            {PAGE_SIZES.map((n) => <option key={n} value={n}>{n} / page</option>)}
          </Select>
        )}
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft className="size-4" /> Prev</Button>
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>Next <ChevronRight className="size-4" /></Button>
      </div>
    </div>
  );
}