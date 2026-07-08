import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Star } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/common/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/DataState';
import { CardThumb } from '@/components/common/CardImage';
import { peso } from '@/lib/utils';
import { favoritesService } from '@/services';
import { apiError } from '@/lib/api';

export function FavoritesPage() {
  const qc = useQueryClient();
  const favorites = useQuery({ queryKey: ['favorites'], queryFn: () => favoritesService.list() });
  const pinned = useQuery({ queryKey: ['pinned'], queryFn: () => favoritesService.pinned() });

  const unpin = useMutation({
    mutationFn: (v: { itemType: string; itemId: string }) => favoritesService.pin(v.itemType, v.itemId, false),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pinned'] }); toast.success('Unpinned'); },
    onError: (e) => toast.error(apiError(e).message),
  });
  const toggleFav = useMutation({
    mutationFn: (v: { itemType: string; itemId: string }) => favoritesService.toggle(v.itemType, v.itemId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['favorites'] }); },
    onError: (e) => toast.error(apiError(e).message),
  });

  const pinnedCards = [
    ...(pinned.data?.rawCards ?? []).map((c: any) => ({ ...c, itemType: 'RAW', price: c.postedPrice })),
    ...(pinned.data?.slabs ?? []).map((s: any) => ({ ...s, itemType: 'SLAB', price: s.sellPrice })),
  ];

  return (
    <>
      <PageHeader title="Favorites" subtitle="Pinned & favorite cards" />

      <h3 className="mb-2.5 text-sm font-bold">Pinned to dashboard</h3>
      {pinned.isLoading ? <Skeleton className="mb-6 h-28 w-full" /> : pinnedCards.length ? (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {pinnedCards.map((c: any) => (
            <Card key={c.id} className="p-3">
              <div className="flex items-start gap-2.5">
                <CardThumb url={c.images?.[0]?.url} alt={c.name} className="h-14 w-10" />
                <div className="min-w-0 flex-1">
                  <b className="block truncate text-[13px]">{c.name}</b>
                  <Badge variant="info">{c.itemType}</Badge>
                  <p className="mt-1 text-[13px] font-bold tabular-nums">{peso(c.price)}</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => unpin.mutate({ itemType: c.itemType, itemId: c.id })}>Unpin</Button>
            </Card>
          ))}
        </div>
      ) : <div className="mb-6"><EmptyState message="No pinned cards." /></div>}

      <h3 className="mb-2.5 text-sm font-bold">Favorites</h3>
      {favorites.isLoading ? <Skeleton className="h-28 w-full" /> : favorites.data?.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {favorites.data.map((f: any) => (
            <Card key={f.id} className="p-3">
              <div className="flex items-start gap-2.5">
                <CardThumb url={f.item?.images?.[0]?.url} alt={f.item?.name} className="h-14 w-10" />
                <div className="min-w-0 flex-1"><b className="block truncate text-[13px]">{f.item?.name}</b><Badge variant="info">{f.itemType}</Badge></div>
              </div>
              <Button variant="ghost" size="sm" className="mt-2 w-full text-warning" onClick={() => toggleFav.mutate({ itemType: f.itemType, itemId: f.item?.id })}>
                <Star className="fill-current" /> Remove
              </Button>
            </Card>
          ))}
        </div>
      ) : <EmptyState message="No favorites yet." />}
    </>
  );
}
