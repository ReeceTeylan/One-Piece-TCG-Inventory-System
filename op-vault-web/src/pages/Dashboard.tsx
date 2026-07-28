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
import { peso, cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

function Delta({ value }: { value: number }) {
  const up = value >= 0;
  return (
    <div className="mt-1.5 flex items-center gap-1 text-[11.5px]">
      {up ? <TrendingUp className="size-3.5 text-success" /> : <TrendingDown className="size-3.5 text-destructive" />}
      <span className={cn('font-semibold', up ? 'text-success' : 'text-destructive')}>{Math.abs(value).toFixed(1)}%</span>
      <span className="text-muted-foreground">vs prev</span>
    </div>
  );
}

function HeroStat({ label, value, delta, onClick }: { label: string; value: string; delta?: number; onClick?: () => void }) {
  return (
    <Card onClick={onClick}
      className={cn('relative overflow-hidden', onClick && 'cursor-pointer transition-colors hover:border-primary/40')}>
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-primary/50 via-primary/20 to-transparent" />
      <CardContent className="p-5">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="mt-2.5 text-[32px] font-bold leading-none tracking-tight tnum">{value}</div>
        {/* Spacer keeps all three hero cards the same height when a delta is absent. */}
        {delta !== undefined ? <Delta value={delta} /> : <div className="mt-1.5 h-[17px]" />}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, onClick, highlight }: { label: string; value: string; onClick?: () => void; highlight?: boolean }) {
  return (
    <Card onClick={onClick} className={cn(onClick && 'cursor-pointer transition-colors hover:border-primary/40')}>
      <CardContent className="p-3.5">
        <div className="text-[11px] font-semibold text-muted-foreground">{label}</div>
        <div className={cn('mt-1.5 text-[19px] font-bold tracking-tight tnum', highlight && 'text-primary')}>{value}</div>
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const [metric, setMetric] = useState<'revenue' | 'profit' | 'cardsSold'>('profit');
  const [targetMonth, setTargetMonth] = useState(''); 
  const dash = useQuery({ queryKey: ['dashboard'], queryFn: analyticsService.dashboard });
  const trends = useQuery({ 
    queryKey: ['trends', 'daily', targetMonth], 
    queryFn: () => analyticsService.trends({ 
      granularity: 'daily', 
      points: 30,
      targetMonth: targetMonth || undefined
    }) 
  });
  // Lifetime monthly series, for the "best month" summary. Independent of the
  // daily chart's month filter.
  const monthly = useQuery({  
    queryKey: ['trends', 'monthly'],
    queryFn: () => analyticsService.trends({ granularity: 'monthly', points: 12 }),
  });
  const d = dash.data;

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Business snapshot"
        actions={<Button onClick={() => navigate('/sales')}><Plus className="size-4" /> New sale</Button>} />

      {!d ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[118px]" />)}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-[72px]" />)}
          </div>
        </>
      ) : (
        <>
          {/* The money story, up top and unmissable. */}
          <div className="grid gap-3 sm:grid-cols-3">
            <HeroStat label="Revenue this month" value={peso(d.revenue.month)} delta={d.growth.revenueMonth} onClick={() => navigate('/sales-history')} />
            <HeroStat label="Profit this month" value={peso(d.profit.month)} delta={d.growth.profitMonth} onClick={() => navigate('/sales-history')} />
            <HeroStat label="Avg daily profit" value={peso(d.avgDailyProfit)} />
          </div>
          {/* Supporting numbers. "Waiting to ship" leads because it's the only one that asks you to do something. */}
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            <Stat label="Waiting to ship" value={String(d.counts.waitingToShip)} highlight={d.counts.waitingToShip > 0} onClick={() => navigate('/shipments')} />
            <Stat label="Inventory value" value={peso(d.inventory.inventoryValue)} />
            <Stat label="Profit margin" value={`${d.inventory.profitMargin}%`} />
            <Stat label="Raw cards" value={String(d.counts.totalRawCards)} onClick={() => navigate('/raw-cards')} />
            <Stat label="Slabs & sealed" value={String(d.counts.totalSlabs)} onClick={() => navigate('/slabs')} />
            <Stat label="Total posted" value={peso(d.inventory.totalPostedPrice)} />
            <Stat label="Total spent" value={peso(d.inventory.totalSpent)} />
          </div>
        </>
      )}

      <Card className="mt-5">
        <CardContent className="p-4">
          <div className="mb-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">Revenue & profit trend</h3>
            
            <div className="flex items-center gap-3">
              {/* NEW: Native HTML5 Month Selector */}
              <div className="flex items-center gap-1.5">
                <Input
                  type="month"
                  value={targetMonth}
                  onChange={(e) => setTargetMonth(e.target.value)}
                  className="h-8 w-[140px] text-xs [color-scheme:dark]"
                  aria-label="Select month"
                />
                {targetMonth && (
                  <button onClick={() => setTargetMonth('')}
                    className="text-[11px] font-semibold text-muted-foreground hover:text-foreground">
                    Clear
                  </button>
                )}
              </div>

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
            : trends.data ? <TrendChart data={trends.data} metric={metric} monthly={monthly.data} />
            : <ErrorState message="No trend data." />}
          <p className="mt-2 text-[11.5px] text-muted-foreground">Hover any point for date, revenue, profit, cards sold, quantity & growth.</p>
        </CardContent>
      </Card>
    </div>
  );
}
