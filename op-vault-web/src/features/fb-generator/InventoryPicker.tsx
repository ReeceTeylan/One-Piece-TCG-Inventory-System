import { useState } from 'react';
import { Search, Plus, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { peso } from '@/lib/utils';
import { useDebounce } from '@/hooks/use-debounce';
import { CardThumb } from '@/components/common/CardImage';
import { useFbInventory } from './use-fb-inventory';
import { toFbCard } from './types';
import type { FbCard } from './types';

// Live inventory picker scoped to a single inventory type (RAW or SLAB).
export function InventoryPicker({ type, selectedKeys, onAdd }: {
  type: 'RAW' | 'SLAB'; selectedKeys: Set<string>; onAdd: (card: FbCard) => void;
}) {
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search);
  const { data, isLoading } = useFbInventory(debounced, type);

  return (
    <div className="flex h-full flex-col">
      <div className="relative mb-2">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search ${type === 'RAW' ? 'raw cards' : 'slabs'}…`} className="pl-9" />
      </div>
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
        {isLoading ? <div className="flex justify-center py-6"><Spinner /></div>
          : !data?.data.length ? <p className="py-8 text-center text-sm text-muted-foreground">No items found.</p>
          : data.data.map((item: any) => {
            const card = toFbCard(item, type);
            const selected = selectedKeys.has(card.key);
            return (
              <div key={card.key} className="flex items-center gap-2.5 rounded-lg border p-2">
                <CardThumb url={card.imageUrl} alt={card.name} className="h-12 w-9" />
                <div className="min-w-0 flex-1">
                  <b className="block truncate text-[13px]">{card.name}</b>
                  <span className="text-[11px] text-muted-foreground">{card.cardNumber} · {peso(card.price)}</span>
                </div>
                <Button size="sm" variant={selected ? 'outline' : 'default'} disabled={selected} onClick={() => onAdd(card)} aria-label="Add card">
                  {selected ? <Check /> : <Plus />}
                </Button>
              </div>
            );
          })}
      </div>
    </div>
  );
}
