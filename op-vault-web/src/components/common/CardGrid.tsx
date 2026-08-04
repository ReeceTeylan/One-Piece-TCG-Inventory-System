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

export function CardGrid({ items, selected, onToggle, onOpen, actions, aspect = '63/88' }: {
  items: GridItem[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onOpen?: (id: string) => void;
  actions?: (id: string) => ReactNode;
  // Raw cards are 63/88; slabs and sealed boxes are taller at 80/130.
  aspect?: '63/88' | '80/130';
}) {
  return (
    // Scrolls internally so the page itself stays fixed, matching the Table.
    <div className="min-h-0 flex-1 overflow-y-auto p-3">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
        {items.map((it) => (
          <div key={it.id}
            data-selected={selected.has(it.id) || undefined}
            className="group relative flex flex-col overflow-hidden rounded-lg border bg-card transition-colors hover:border-primary/40 data-[selected]:border-primary">
            <input type="checkbox" aria-label={`Select ${it.title}`}
              checked={selected.has(it.id)} onChange={() => onToggle(it.id)}
              className="absolute left-2 top-2 z-10 size-4 cursor-pointer rounded" />
            {it.badge && <div className="absolute right-2 top-2 z-10">{it.badge}</div>}
            <button type="button" onClick={() => onOpen?.(it.id)}
              className={`block w-full overflow-hidden bg-muted ${aspect === '80/130' ? 'aspect-[80/130]' : 'aspect-[63/88]'}`}>
              {it.imageUrl
                ? <img src={it.imageUrl} alt={it.title} loading="lazy"
                    className="size-full object-cover transition-transform duration-200 group-hover:scale-[1.04]" />
                : <div className="grid size-full place-items-center text-[11px] text-muted-foreground">No image</div>}
            </button>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5 p-1.5">
              <div className="truncate text-[12px] font-medium leading-tight">{it.title}</div>
              {it.subtitle && <div className="truncate text-[10px] text-muted-foreground">{it.subtitle}</div>}
              <div className="mt-0.5 flex items-center justify-between gap-1">
                <span className="truncate text-[12.5px] font-semibold tnum">{it.price}</span>
                {it.meta && <span className="shrink-0 text-[10px] text-muted-foreground">{it.meta}</span>}
              </div>
            </div>
            {actions && (
              <div className="flex items-center justify-evenly border-t p-0.5 [&_button]:size-7 [&_button]:shrink-0 [&_button]:p-0 [&_span]:hidden [&_svg]:size-4">{actions(it.id)}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}