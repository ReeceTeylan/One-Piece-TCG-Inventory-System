import type { ReactNode } from 'react';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-3 sm:mb-5">
      <Breadcrumbs />
      <div className="flex flex-wrap items-center justify-between gap-2 sm:items-end sm:gap-3">
        <div className="min-w-0 flex-1 sm:flex-none"><h1 className="text-lg font-bold tracking-tight sm:text-xl md:text-[22px]">{title}</h1>{subtitle && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground sm:text-sm">{subtitle}</p>}</div>
        {actions && <div className="flex shrink-0 flex-wrap gap-1.5 sm:max-w-full sm:gap-2">{actions}</div>}
      </div>
    </div>
  );
}
