import type { ReactNode } from 'react';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-3 sm:mb-5">
      <Breadcrumbs />
      <div className="flex flex-wrap items-end justify-between gap-2.5 sm:gap-3">
        <div><h1 className="text-lg font-bold tracking-tight sm:text-xl md:text-[22px]">{title}</h1>{subtitle && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground sm:text-sm">{subtitle}</p>}</div>
        {actions && <div className="flex max-w-full flex-wrap gap-2 max-sm:w-full">{actions}</div>}
      </div>
    </div>
  );
}
