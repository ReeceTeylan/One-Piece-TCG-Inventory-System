import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { rawCardsService } from '@/services';
import { apiError } from '@/lib/api';
import { toFbCard } from './types';
import type { FbCard } from './types';

// Fetches every in-stock raw card, sorted by postedPrice (highest first),
// converted to FbCard via the shared toFbCard so batch cards behave like picker cards.
export function useBatchFill() {
  const [loading, setLoading] = useState(false);

  const fetchAllRawSortedByValue = useCallback(async (): Promise<FbCard[]> => {
    setLoading(true);
    try {
      const limit = 100;
      const all: FbCard[] = [];
      const seen = new Set<string>();

      // Page 1 tells us how many pages there are.
      const first = await rawCardsService.list({
        page: 1, limit, sortBy: 'postedPrice', sortOrder: 'desc',
      });

      const collect = (rows: any[]) => {
        for (const c of rows) {
          if (c.quantity > 0 && c.status !== 'SOLD' && c.status !== 'OUT') {
            const card = toFbCard(c, 'RAW');
            if (seen.has(card.key)) continue; // guard against paginated duplicates
            seen.add(card.key);
            all.push(card);
          }
        }
      };

      collect(first.data);
      const totalPages = first.meta?.totalPages ?? 1;

      for (let page = 2; page <= totalPages; page++) {
        const res = await rawCardsService.list({
          page, limit, sortBy: 'postedPrice', sortOrder: 'desc',
        });
        collect(res.data);
      }

      return all;
    } catch (e) {
      toast.error(apiError(e).message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  return { fetchAllRawSortedByValue, loading };
}