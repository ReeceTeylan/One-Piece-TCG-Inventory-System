import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { marketPricesService } from '@/services';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CardThumb } from '@/components/common/CardImage';
import { changeLabel } from '@/features/market/use-card-market';
import { cn, peso } from '@/lib/utils';

/** Dashboard card: the five biggest market price moves since the last sync. */
export function MarketMovers() {
  const navigate = useNavigate();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['market-movers'], queryFn: () => marketPricesService.movers(5), staleTime: 5 * 60_000,
  });
  if (isError) return null;

  return (
    <Card className="mt-3">
      <CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Market movers</h3>
            <p className="text-[11.5px] text-muted-foreground">
              {data ? (data.changed ? `${data.changed} card${data.changed === 1 ? '' : 's'} changed price at the last sync` : 'No price changes at the last sync') : 'Since the last sync'}
            </p>
          </div>
          <button onClick={() => navigate('/market-prices')}
            className="flex shrink-0 items-center gap-1 text-xs font-semibold text-primary hover:underline">
            View all <ArrowRight className="size-3.5" />
          </button>
        </div>
        {isLoading ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[62px]" />)}
          </div>
        ) : data?.data.length ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {data.data.map((m) => (
              <button key={m.id} onClick={() => navigate(`/market-prices?search=${encodeURIComponent(m.cardNumber)}`)}
                className="flex min-w-0 items-center gap-2.5 rounded-lg border p-2 text-left transition-colors hover:border-primary/40">
                <CardThumb url={m.imageUrl} alt={m.name} className="aspect-[63/88] w-[34px]" zoomable={false} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] font-semibold">{m.name}</div>
                  <div className="truncate text-[11px] text-muted-foreground">{m.cardNumber} · {m.rarity}{m.language === 'EN' ? ' · EN' : ''}</div>
                  <div className="flex flex-wrap items-baseline gap-x-1.5">
                    <span className="text-[12.5px] font-bold tabular-nums">{peso(m.marketPhp)}</span>
                    {m.changePhp !== null && (
                      <span className={cn('whitespace-nowrap text-[11px] font-semibold tabular-nums', m.changePhp > 0 ? 'text-success' : 'text-destructive')}>
                        {changeLabel(m.changePhp, m.changePct)}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p className="py-3 text-center text-sm text-muted-foreground">Prices move after the 3 AM sync. Check back tomorrow.</p>
        )}
      </CardContent>
    </Card>
  );
}
