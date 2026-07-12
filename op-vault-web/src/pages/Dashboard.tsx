import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, TrendingUp, TrendingDown } from 'lucide-react';
import { analyticsService } from '@/services';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendChart } from '@/components/common/TrendChart';
import { ErrorState } from '@/components/common/DataState';
import { peso } from '@/lib/utils';
import { Input } from '@/components/ui/input';

function Stat({ label, value, delta }: { label: string; value: string; delta?: number }) {
  return (
    <Card><CardContent className="p-4">
      <div className="text-[11.5px] font-semibold text-muted-foreground">{label}</div>
      <div className="mt-2 text-[23px] font-bold tracking-tight tnum">{value}</div>
      {delta !== undefined && (
        <div className="mt-1 flex items-center gap-1 text-[11.5px]">
          {delta >= 0 ? <TrendingUp className="size-3.5 text-success" /> : <TrendingDown className="size-3.5 text-destructive" />}
          <span className={delta >= 0 ? 'font-semibold text-success' : 'font-semibold text-destructive'}>{Math.abs(delta).toFixed(1)}%</span>
          <span className="text-muted-foreground">vs prev</span>
        </div>
      )}
    </CardContent></Card>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const [metric, setMetric] = useState<'revenue' | 'profit' | 'cardsSold'>('revenue');
  const [targetMonth, setTargetMonth] = useState(''); 
  const dash = useQuery({ queryKey: ['dashboard'], queryFn: analyticsService.dashboard });
  const trends = useQuery({ 
    queryKey: ['trends', 'daily', targetMonth], 
    queryFn: () => analyticsService.trends({ 
      granularity: 'daily', 
      points: 30,
      targetMonth
    }) 
  });
  const d = dash.data;

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Business snapshot"
        actions={<Button onClick={() => navigate('/sales')}><Plus className="size-4" /> New sale</Button>} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {!d ? Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-[92px]" />) : (
          <>
            <Stat label="Inventory value" value={peso(d.inventory.inventoryValue)} />
            <Stat label="Total raw cards" value={String(d.counts.totalRawCards)} />
            <Stat label="Total slabs" value={String(d.counts.totalSlabs)} />
            <Stat label="Revenue today" value={peso(d.revenue.today)} />
            <Stat label="Revenue month" value={peso(d.revenue.month)} delta={d.growth.revenueMonth} />
            <Stat label="Profit month" value={peso(d.profit.month)} delta={d.growth.profitMonth} />
            <Stat label="Profit margin" value={`${d.inventory.profitMargin}%`} />
            <Stat label="Waiting to ship" value={String(d.counts.waitingToShip)} />
            <Stat label="Total posted price" value={peso(d.inventory.totalPostedPrice)} />
            <Stat label="Total spent" value={peso(d.inventory.totalSpent)} />
          </>
        )}
      </div>

      <Card className="mt-5">
        <CardContent className="p-4">
          <div className="mb-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">Revenue & profit trend</h3>
            
            <div className="flex items-center gap-3">
              {/* NEW: Native HTML5 Month Selector */}
              <Input
                type="month"
                value={targetMonth}
                onChange={(e) => setTargetMonth(e.target.value)}
                className="h-8 w-auto text-xs"
                aria-label="Select month"
              />

              {/* EXISTING: Metric Toggles */}
              <div className="flex gap-1 rounded-md border bg-muted p-0.5">
                {(['revenue', 'profit', 'cardsSold'] as const).map((m) => (
                  <button key={m} onClick={() => setMetric(m)}
                    className={`rounded px-3 py-1 text-xs font-semibold capitalize ${metric === m ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}>
                    {m === 'cardsSold' ? 'Cards sold' : m}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {trends.isLoading ? <Skeleton className="h-[230px] w-full" />
            : trends.data ? <TrendChart data={trends.data} metric={metric} />
            : <ErrorState message="No trend data." />}
          <p className="mt-2 text-[11.5px] text-muted-foreground">Hover any point for date, revenue, profit, cards sold, quantity & growth.</p>
        </CardContent>
      </Card>
    </div>
  );
}
