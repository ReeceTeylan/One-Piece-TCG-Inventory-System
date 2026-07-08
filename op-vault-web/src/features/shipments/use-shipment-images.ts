import { useQueries } from '@tanstack/react-query';
import { rawCardsService, slabsService } from '@/services';
import type { Sale } from '@/types';

export interface ResolvedItem {
  id: string;
  name: string;
  quantity: number;
  imageUrl?: string;
  meta?: string;
}

// Resolves card thumbnails for each sale item so shipments can show what was bought.
export function useShipmentImages(sale?: Sale): { items: ResolvedItem[]; loading: boolean } {
  const saleItems = sale?.items ?? [];

  const queries = useQueries({
    queries: saleItems.map((it) => ({
      queryKey: ['ship-img', it.itemType, it.rawCardId ?? it.slabId ?? it.id],
      queryFn: () =>
        it.itemType === 'RAW' && it.rawCardId
          ? rawCardsService.get(it.rawCardId)
          : it.slabId
            ? slabsService.get(it.slabId)
            : Promise.resolve(null),
      enabled: !!(it.rawCardId || it.slabId),
      staleTime: 5 * 60_000,
    })),
  });

  const items: ResolvedItem[] = saleItems.map((it, i) => {
    const card: any = queries[i]?.data;
    const meta = it.itemType === 'SLAB'
      ? [card?.gradingCompany, card?.grade].filter(Boolean).join(' ')
      : card?.cardNumber;
    return {
      id: it.id,
      name: it.nameSnapshot,
      quantity: it.quantity,
      imageUrl: card?.images?.[0]?.url,
      meta: meta || undefined,
    };
  });

  const loading = queries.some((q) => q.isLoading);
  return { items, loading };
}
