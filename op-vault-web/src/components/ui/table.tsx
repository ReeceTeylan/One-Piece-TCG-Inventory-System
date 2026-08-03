import * as React from 'react';
import { cn } from '@/lib/utils';
export const Table = ({ className, ...p }: React.HTMLAttributes<HTMLTableElement>) => (
  // flex-1 + min-h-0 means the table takes exactly the space left over after the
  // page header, filters and pagination — no magic number to keep in sync.
  // Thin, dark scrollbar so it doesn't sit as a bright block over the row actions.
  <div className="min-h-0 w-full flex-1 overflow-auto [scrollbar-color:hsl(var(--border))_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-1.5"><table className={cn('min-w-full text-sm', className)} {...p} /></div>);
export const THead = (p: React.HTMLAttributes<HTMLTableSectionElement>) => <thead {...p} />;
export const TBody = (p: React.HTMLAttributes<HTMLTableSectionElement>) => <tbody {...p} />;
export const TR = ({ className, ...p }: React.HTMLAttributes<HTMLTableRowElement>) => <tr className={cn('border-b transition-colors hover:bg-muted/50', className)} {...p} />;
export const TH = ({ className, ...p }: React.ThHTMLAttributes<HTMLTableCellElement>) => <th className={cn('sticky top-0 z-10 bg-muted px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground', className)} {...p} />;
export const TD = ({ className, ...p }: React.TdHTMLAttributes<HTMLTableCellElement>) => <td className={cn('px-3 py-2.5 align-middle', className)} {...p} />;
