import * as React from 'react';
import { cn } from '@/lib/utils';
export const Table = ({ className, ...p }: React.HTMLAttributes<HTMLTableElement>) => (
  // Bounded height means the table scrolls internally and the page doesn't —
  // so the scrollbar sits against the table, not the browser edge.
  <div className="max-h-[70vh] w-full overflow-auto"><table className={cn('min-w-full text-sm', className)} {...p} /></div>);
export const THead = (p: React.HTMLAttributes<HTMLTableSectionElement>) => <thead {...p} />;
export const TBody = (p: React.HTMLAttributes<HTMLTableSectionElement>) => <tbody {...p} />;
export const TR = ({ className, ...p }: React.HTMLAttributes<HTMLTableRowElement>) => <tr className={cn('border-b transition-colors hover:bg-muted/50', className)} {...p} />;
export const TH = ({ className, ...p }: React.ThHTMLAttributes<HTMLTableCellElement>) => <th className={cn('sticky top-0 z-10 bg-muted px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground', className)} {...p} />;
export const TD = ({ className, ...p }: React.TdHTMLAttributes<HTMLTableCellElement>) => <td className={cn('px-3 py-2.5 align-middle', className)} {...p} />;
