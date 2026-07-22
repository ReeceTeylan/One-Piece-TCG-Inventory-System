import { useQuery } from '@tanstack/react-query';
import { rawCardsService, slabsService } from '@/services';

export function useFbInventory(search: string, tab: 'RAW' | 'SLAB') {
  const raw = useQuery({
    queryKey: ['fb-raw', search], enabled: tab === 'RAW',
    queryFn: async () => {
      const res = await rawCardsService.list({ search: search || undefined, limit: 40, sortBy: 'postedPrice', sortOrder: 'desc' });
      // Only in-stock raw cards.
      return { ...res, data: res.data.filter((c) => c.quantity > 0 && c.status !== 'SOLD' && c.status !== 'OUT') };
    },
  });
  const slabs = useQuery({
    queryKey: ['fb-slab', search], enabled: tab === 'SLAB',
    queryFn: async () => {
      const res = await slabsService.list({ search: search || undefined, limit: 40, sortBy: 'sellPrice', sortOrder: 'desc' });
      // Hide slabs that are already sold.
      return { ...res, data: res.data.filter((sl) => sl.status !== 'SOLD') };
    },
  });
  return tab === 'RAW' ? raw : slabs;
}