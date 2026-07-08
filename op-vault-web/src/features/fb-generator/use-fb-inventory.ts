import { useQuery } from '@tanstack/react-query';
import { rawCardsService, slabsService } from '@/services';

export function useFbInventory(search: string, tab: 'RAW' | 'SLAB') {
  const raw = useQuery({
    queryKey: ['fb-raw', search], enabled: tab === 'RAW',
    queryFn: () => rawCardsService.list({ search: search || undefined, limit: 40, sortBy: 'createdAt', sortOrder: 'desc' }),
  });
  const slabs = useQuery({
    queryKey: ['fb-slab', search], enabled: tab === 'SLAB',
    queryFn: () => slabsService.list({ search: search || undefined, limit: 40, sortBy: 'createdAt', sortOrder: 'desc' }),
  });
  return tab === 'RAW' ? raw : slabs;
}
