import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/common/PageHeader';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendChart } from '@/components/common/TrendChart';
import { peso } from '@/lib/utils';
import { analyticsService } from '@/services';

function StatGrid({ title, items, loading }: { title: string; items: [string, string][]; loading?: boolean }) {
  return (
    <div className="mb-5">
      <h3 className="mb-2.5 text-sm font-bold">{title}</h3>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {items.map(([label, value]) => (
          <div key={label} className="rounded-lg border bg-card p-3.5 shadow-sm">
            <div className="text-[11px] font-semibold text-muted-foreground">{label}</div>
            {loading ? <Skeleton className="mt-1.5 h-6 w-20" /> : <div className="mt-1 text-lg font-bold tabular-nums">{value}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

export function AnalyticsPage() {
  const inventory = useQuery({ queryKey: ['an-inventory'], queryFn: () => analyticsService.inventory() });
  const cards = useQuery({ queryKey: ['an-cards'], queryFn: () => analyticsService.cards({ limit: 8 }) });
  const slabs = useQuery({ queryKey: ['an-slabs'], queryFn: () => analyticsService.slabs() });
  const trends = useQuery({ queryKey: ['an-trends'], queryFn: () => analyticsService.trends({ granularity: 'daily', points: 30 }) });
  const inv = inventory.data;
  const sl = slabs.data;

  return (
    <>
      <PageHeader title="Analytics" subtitle="Inventory, sales, cards & slabs performance" />

      <StatGrid title="Inventory" loading={inventory.isLoading} items={[
        ['Inventory value', peso(inv?.inventoryValue ?? 0)],
        ['Avg buying cost', peso(inv?.averageBuyingCost ?? 0)],
        ['Avg selling price', peso(inv?.averageSellingPrice ?? 0)],
        ['Profit margin', `${inv?.profitMargin ?? 0}%`],
      ]} />

      <StatGrid title="Slabs" loading={slabs.isLoading} items={[
        ['Available', String(sl?.totalAvailable ?? 0)],
        ['Slabs sold', String(sl?.slabsSold ?? 0)],
        ['Slab revenue', peso(sl?.slabRevenue ?? 0)],
        ['Slab profit', peso(sl?.slabProfit ?? 0)],
      ]} />

      <Card className="mb-5 p-4">
        <h3 className="mb-2 text-sm font-bold">Profit trend</h3>
        {trends.isLoading ? <Skeleton className="h-56 w-full" /> : <TrendChart data={trends.data ?? []} metric="profit" />}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h3 className="mb-2 text-sm font-bold">Best sellers</h3>
          {cards.isLoading ? <Skeleton className="h-40 w-full" /> : cards.data?.bestSellers?.length ? cards.data.bestSellers.map((c: any, i: number) => (
            <div key={c.id} className="flex items-center gap-3 border-b py-2 last:border-0">
              <span className="grid size-5 place-items-center rounded bg-muted text-[11px] font-bold text-muted-foreground">{i + 1}</span>
              <div className="min-w-0 flex-1"><p className="truncate text-[13px] font-medium">{c.name}</p><p className="text-[11px] text-muted-foreground">{c.rarity} · {c.totalSold} sold</p></div>
              <b className="tabular-nums text-[13px]">{peso(c.postedPrice)}</b>
            </div>
          )) : <p className="py-6 text-center text-sm text-muted-foreground">No data</p>}
        </Card>

        <Card className="p-4">
          <h3 className="mb-2 text-sm font-bold">Top selling rarities</h3>
          {cards.isLoading ? <Skeleton className="h-40 w-full" /> : cards.data?.topRarities?.length ? cards.data.topRarities.map((r: any) => (
            <div key={r.rarity} className="mb-2.5">
              <div className="flex justify-between text-[12.5px]"><b>{r.rarity}</b><span className="tabular-nums text-muted-foreground">{r.sold} · {peso(r.revenue)}</span></div>
              <div className="mt-1 h-1.5 rounded bg-muted"><div className="h-full rounded bg-primary" style={{ width: `${Math.min(100, (r.sold / (cards.data.topRarities[0]?.sold || 1)) * 100)}%` }} /></div>
            </div>
          )) : <p className="py-6 text-center text-sm text-muted-foreground">No data</p>}
        </Card>

        <Card className="p-4">
          <h3 className="mb-2 text-sm font-bold">Highest profit cards</h3>
          {cards.data?.highestProfit?.length ? cards.data.highestProfit.map((c: any) => (
            <div key={c.rawcardid} className="flex items-center justify-between border-b py-2 last:border-0">
              <span className="text-[13px]">{c.name}</span><b className="tabular-nums text-[13px] text-success">{peso(c.profit)}</b>
            </div>
          )) : <p className="py-6 text-center text-sm text-muted-foreground">No data</p>}
        </Card>

        <Card className="p-4">
          <h3 className="mb-2 text-sm font-bold">Stock health</h3>
          {cards.data?.lowStock?.map((c: any) => (
            <div key={c.id} className="flex items-center justify-between border-b py-2 last:border-0">
              <span className="text-[13px]">{c.name}</span><Badge variant="warning">{c.quantity} left</Badge>
            </div>
          ))}
          {cards.data?.deadStock?.slice(0, 4).map((c: any) => (
            <div key={c.id} className="flex items-center justify-between border-b py-2 last:border-0">
              <span className="text-[13px]">{c.name}</span><Badge variant="default">Dead</Badge>
            </div>
          ))}
          {!cards.data?.lowStock?.length && !cards.data?.deadStock?.length && <p className="py-6 text-center text-sm text-muted-foreground">All healthy</p>}
        </Card>
      </div>
    </>
  );
}
