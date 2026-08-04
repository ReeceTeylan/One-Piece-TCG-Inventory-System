import type { ReactNode } from 'react';

export type GridItem = {
  id: string;
  imageUrl?: string;
  title: string;
  subtitle?: string;
  price: ReactNode;
  meta?: ReactNode;
  badge?: ReactNode;
};

export function CardGrid({ items, selected, onToggle, onOpen, actions }: {
  items: GridItem[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onOpen?: (id: string) => void;
  actions?: (id: string) => ReactNode;
}) {
  return (
    // Scrolls internally so the page itself stays fixed, matching the Table.
    <div className="min-h-0 flex-1 overflow-y-auto p-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {items.map((it) => (
          <div key={it.id}
            data-selected={selected.has(it.id) || undefined}
            className="group relative flex flex-col overflow-hidden rounded-lg border bg-card transition-colors hover:border-primary/40 data-[selected]:border-primary">
            <input type="checkbox" aria-label={`Select ${it.title}`}
              checked={selected.has(it.id)} onChange={() => onToggle(it.id)}
              className="absolute left-2 top-2 z-10 size-4 cursor-pointer rounded" />
            {it.badge && <div className="absolute right-2 top-2 z-10">{it.badge}</div>}
            <button type="button" onClick={() => onOpen?.(it.id)}
              className="block aspect-[63/88] w-full overflow-hidden bg-muted">
              {it.imageUrl
                ? <img src={it.imageUrl} alt={it.title} loading="lazy"
                    className="size-full object-cover transition-transform duration-200 group-hover:scale-[1.04]" />
                : <div className="grid size-full place-items-center text-[11px] text-muted-foreground">No image</div>}
            </button>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5 p-2.5">
              <div className="truncate text-[13px] font-medium">{it.title}</div>
              {it.subtitle && <div className="truncate text-[11px] text-muted-foreground">{it.subtitle}</div>}
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold tnum">{it.price}</span>
                {it.meta && <span className="shrink-0 text-[11px] text-muted-foreground">{it.meta}</span>}
              </div>
            </div>
            {actions && (
              <div className="flex items-center justify-end gap-0.5 border-t px-1 py-1">{actions(it.id)}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}