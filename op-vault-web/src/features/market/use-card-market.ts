import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { marketPricesService } from '@/services';

/** Market price for the given raw card ids (one request for the whole page). */
export function useCardMarket(ids: string[]) {
  const key = [...new Set(ids)].sort().join(',');
  return useQuery({
    queryKey: ['card-market', key],
    queryFn: () => marketPricesService.forCards(key.split(',')),
    enabled: key.length > 0,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}

/** Set one card's posted price to its rounded market price, then refresh every view of it. */
export function useMatchPrice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => marketPricesService.match(id),
    onSuccess: () => {
      for (const k of ['raw-cards', 'card-market', 'market-prices', 'market-movers', 'dashboard']) {
        qc.invalidateQueries({ queryKey: [k] });
      }
    },
  });
}

/** "▲ ₱120 (+8%)" style label for a peso change. */
export function changeLabel(changePhp: number, changePct?: number | null) {
  const arrow = changePhp > 0 ? '▲' : '▼';
  const pct = changePct != null ? ` (${changePct > 0 ? '+' : ''}${changePct}%)` : '';
  return `${arrow} ₱${Math.abs(changePhp).toLocaleString('en-PH')}${pct}`;
}
