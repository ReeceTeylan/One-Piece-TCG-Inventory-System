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
    <div className="min-h-0 flex-1 overflow-y-auto p-2 sm:p-3">
      <div className="grid grid-cols-2 gap-2.5 sm:gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
        {items.map((it) => (
          <div key={it.id}
            data-selected={selected.has(it.id) || undefined}
            className="group relative flex flex-col overflow-hidden rounded-lg border bg-card transition-colors hover:border-primary/40 data-[selected]:border-primary">
            <input type="checkbox" aria-label={`Select ${it.title}`}
              checked={selected.has(it.id)} onChange={() => onToggle(it.id)}
              className="absolute left-2 top-2 z-10 size-5 cursor-pointer rounded shadow-sm sm:size-4" />
            {it.badge && <div className="absolute right-2 top-2 z-10 max-sm:hidden">{it.badge}</div>}
            <button type="button" onClick={() => onOpen?.(it.id)}
              className={`block w-full overflow-hidden bg-muted max-sm:h-[150px] ${aspect === '80/130' ? 'sm:aspect-[80/130]' : 'sm:aspect-[63/88]'}`}>
              {it.imageUrl
                ? <img src={it.imageUrl} alt={it.title} loading="lazy"
                    className="size-full object-contain transition-transform duration-200 sm:object-cover sm:group-hover:scale-[1.04]" />
                : <div className="grid size-full place-items-center text-[11px] text-muted-foreground">No image</div>}
            </button>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5 p-2 sm:p-1.5">
              <div className="truncate text-[13px] font-semibold leading-tight sm:text-[12px] sm:font-medium">{it.title}</div>
              {it.badge && <div className="truncate text-[11px] sm:hidden">{it.badge}</div>}
              {it.subtitle && <div className="truncate text-[10px] text-muted-foreground">{it.subtitle}</div>}
              <div className="mt-auto flex min-w-0 flex-col gap-0.5 pt-1 sm:mt-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-1 sm:pt-0">
                <span className="truncate text-[14px] font-semibold tnum sm:text-[12.5px]">{it.price}</span>
                {it.meta && <span className="truncate text-[10px] text-muted-foreground sm:shrink-0">{it.meta}</span>}
              </div>
            </div>
            {actions && (
              <div className="flex flex-wrap items-center justify-evenly gap-0.5 border-t p-1 [&_button]:size-9 [&_button]:shrink-0 [&_button]:px-1 [&_button]:text-xs [&_button]:gap-0 [&_svg]:size-4 sm:flex sm:items-center sm:justify-evenly sm:gap-0 sm:p-0.5 sm:[&_button]:size-7 sm:[&_button]:shrink-0 sm:[&_button]:p-0 sm:[&_span]:hidden">{actions(it.id)}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}