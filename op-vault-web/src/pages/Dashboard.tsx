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
  import { StrawHatLoader } from '@/components/common/StrawHatLoader';
  import { peso, cn } from '@/lib/utils';
  import { Gear5Number } from '@/components/ui/gear5-number';
  import { HeroAura } from '@/components/common/HeroAura';
  import { Input } from '@/components/ui/input';
  import { MarketMovers } from '@/components/common/MarketMovers';
  import { useStickyState } from '@/hooks/use-sticky-state';

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

  function HeroStat({ label, value, delta, index, onClick }: { label: string; value: number; delta?: number; index: number; onClick?: () => void }) {
  return (
    <Card onClick={onClick}
      className={cn('relative overflow-hidden', onClick && 'cursor-pointer transition-colors hover:border-primary/40')}>
      <HeroAura index={index} />
      <CardContent className="relative p-3 sm:p-5">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
        <Gear5Number value={value} format={peso}
          className="mt-2 block text-[24px] font-bold leading-tight tracking-tight tnum break-words sm:mt-2.5 sm:text-[32px] sm:leading-none" />
        {/* Spacer keeps all three hero cards the same height when a delta is absent. */}
        {delta !== undefined ? <Delta value={delta} /> : <div className="mt-1.5 h-[17px]" />}
      </CardContent>
    </Card>
  );
}

  function Stat({ label, value, onClick, highlight, lines, title }: { label: string; value: string; onClick?: () => void; highlight?: boolean; lines?: string[]; title?: string }) {
    return (
      <Card onClick={onClick} title={title} className={cn(onClick && 'cursor-pointer transition-colors hover:border-primary/40')}>
        <CardContent className="min-w-0 p-2.5 sm:p-3.5">
          <div className="text-[11px] font-semibold text-muted-foreground">{label}</div>
          <div className={cn('mt-1.5 break-words text-[15px] font-bold tracking-tight tnum sm:text-[19px]', highlight && 'text-primary')}>{value}</div>
          {lines?.map((l) => <div key={l} className="break-words text-[10px] leading-snug text-muted-foreground tnum sm:text-[10.5px]">{l}</div>)}
        </CardContent>
      </Card>
    );
  }

  export function DashboardPage() {
    const navigate = useNavigate();
    const [metric, setMetric] = useStickyState<'revenue' | 'profit' | 'cardsSold'>('dashboard:metric', 'profit', { allowed: ['revenue', 'profit', 'cardsSold'] });
    // Default to the current calendar month, matching the "this month" stat cards.
    const currentMonth = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }).slice(0, 7);
    // Kept for this visit only, so a new day still opens on the current month.
    const [targetMonth, setTargetMonth] = useStickyState('dashboard:month', currentMonth, { session: true });
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
      <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
        <PageHeader title="Dashboard" subtitle="Business snapshot"
          actions={<Button onClick={() => navigate('/sales')}><Plus className="size-4" /> New sale</Button>} />

        {!d ? (
          <>
            <div className="grid min-w-0 gap-2.5 sm:grid-cols-3 sm:gap-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[118px]" />)}
            </div>
            <div className="mt-3 grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-7">
              {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-[72px]" />)}
            </div>
          </>
        ) : (
          <>
            {/* The money story, up top and unmissable. */}
            <div className="grid min-w-0 gap-2.5 sm:grid-cols-3 sm:gap-3">
            <HeroStat index={0} label="Revenue this month" value={d.revenue.month} delta={d.growth.revenueMonth} onClick={() => navigate('/sales-history')} />
            <HeroStat index={1} label="Profit this month" value={d.profit.month} delta={d.growth.profitMonth} onClick={() => navigate('/sales-history')} />
            <HeroStat index={2} label="Avg daily profit" value={d.avgDailyProfit} />
            </div>
            {/* Supporting numbers. "Waiting to ship" leads because it's the only one that asks you to do something. */}
            <div className="mt-3 grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-7">
              <Stat label="Waiting to ship" value={String(d.counts.waitingToShip)} highlight={d.counts.waitingToShip > 0} onClick={() => navigate('/shipments')} />
              <Stat label="Inventory value" value={peso(d.inventory.inventoryValue)} onClick={() => navigate('/market-prices')}
                lines={d.inventory.inventoryBreakdown && [
                  `Raw ${peso(d.inventory.inventoryBreakdown.rawMarket + d.inventory.inventoryBreakdown.rawFallback)}`,
                  `Slabs & sealed ${peso(d.inventory.inventoryBreakdown.slabsAndSealed)}`,
                ]}
                title={d.inventory.inventoryBreakdown && [
                  `Raw at market price: ${peso(d.inventory.inventoryBreakdown.rawMarket)} (${d.inventory.inventoryBreakdown.rawMatchedCards} cards)`,
                  `Raw at 80% of posted (no market price): ${peso(d.inventory.inventoryBreakdown.rawFallback)} (${d.inventory.inventoryBreakdown.rawFallbackCards} cards)`,
                  `Slabs & sealed at 80% of posted: ${peso(d.inventory.inventoryBreakdown.slabsAndSealed)}`,
                ].join('\n')} />
              <Stat label="Profit margin" value={`${d.inventory.profitMargin}%`} />
              <Stat label="Raw cards" value={String(d.counts.totalRawCards)} onClick={() => navigate('/raw-cards')} />
              <Stat label="Slabs & sealed" value={String(d.counts.totalSlabs)} onClick={() => navigate('/slabs')} />
              <Stat label="Total posted" value={peso(d.inventory.totalPostedPrice)} />
              <Stat label="Total spent" value={peso(d.inventory.totalSpent)} />
            </div>
          </>
        )}

        <MarketMovers />

        <Card className="mt-4 min-w-0 max-w-full overflow-hidden sm:mt-5">
          <CardContent className="min-w-0 p-3 sm:p-4">
            <div className="mb-3 flex min-w-0 flex-col items-start justify-between gap-2.5 sm:flex-row sm:items-center sm:gap-3">
              <h3 className="text-sm font-semibold">Revenue & profit trend</h3>
              
              <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
                {/* NEW: Native HTML5 Month Selector */}
                <div className="flex min-w-0 items-center gap-1.5">
                  <Input
                    type="month"
                    value={targetMonth}
                    onChange={(e) => setTargetMonth(e.target.value)}
                    className="h-9 min-w-0 w-[170px] max-w-full text-sm sm:h-8 sm:w-[140px] sm:text-xs [color-scheme:dark]"
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
                <div className="grid w-full min-w-0 grid-cols-3 gap-1 rounded-md border bg-muted p-0.5 sm:flex sm:w-auto">
                  {(['revenue', 'profit', 'cardsSold'] as const).map((m) => (
                    <button key={m} onClick={() => setMetric(m)}
                      className={`min-w-0 rounded px-1.5 py-2 text-[11px] font-semibold capitalize sm:px-3 sm:py-1 sm:text-xs ${metric === m ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}>
                      {m === 'cardsSold' ? 'Cards sold' : m}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {trends.isLoading ? <StrawHatLoader className="h-[230px]" label="Loading trend…" />
              : trends.data ? <TrendChart data={trends.data} metric={metric} monthly={monthly.data} />
              : <ErrorState message="No trend data." />}
            <p className="mt-2 text-[11.5px] text-muted-foreground"><span className="sm:hidden">Tap a chart point to view details.</span><span className="max-sm:hidden">Hover any point for date, revenue, profit, cards sold, quantity & growth.</span></p>
          </CardContent>
        </Card>
      </div>
    );
  }
