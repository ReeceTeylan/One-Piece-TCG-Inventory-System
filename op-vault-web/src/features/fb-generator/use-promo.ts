import { useQuery } from '@tanstack/react-query';
import { promosService } from '@/services';

/** Active promo, shared across the app via one cache key. */
export function usePromo() {
  return useQuery({
    queryKey: ['promo-active'],
    queryFn: promosService.active,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}