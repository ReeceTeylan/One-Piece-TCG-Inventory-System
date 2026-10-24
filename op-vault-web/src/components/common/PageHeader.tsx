import type { ReactNode } from 'react';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-3 min-w-0 sm:mb-5">
      <Breadcrumbs />
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-2.5 sm:items-end sm:gap-3">
        <div className="min-w-0 flex-1 basis-[180px] sm:basis-auto"><h1 className="break-words text-lg font-bold leading-snug tracking-tight sm:text-xl md:text-[22px]">{title}</h1>{subtitle && <p className="mt-1 max-w-prose break-words text-xs leading-relaxed text-muted-foreground sm:text-sm">{subtitle}</p>}</div>
        {actions && <div className="flex min-w-0 flex-wrap gap-1.5 sm:max-w-full sm:gap-2">{actions}</div>}
      </div>
    </header>
  );
}
