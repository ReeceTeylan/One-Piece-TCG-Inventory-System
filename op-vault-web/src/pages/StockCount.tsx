import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, Minus, Plus, Check, RotateCcw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/common/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { CardThumb } from '@/components/common/CardImage';
import { Pagination } from '@/components/common/Pagination';
import { TableSkeleton, ErrorState, EmptyState } from '@/components/common/DataState';
import { useDebounce } from '@/hooks/use-debounce';
import { apiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { rawCardsService, slabsService, stockCountService } from '@/services';
import { useStickyState } from '@/hooks/use-sticky-state';

type Tab = 'RAW' | 'SLAB';
interface Row {
  key: string; itemType: Tab; id: string; name: string; sub: string;
  qty: number; graded: boolean; image?: string | null;
}

// "Counted" ticks live only in this browser so a count can span several
// sittings. They never affect stock; only saved adjustments do.
const SESSION_KEY = 'opv:stockcount:session';
function loadSession(): Record<string, number> {
  try {
    const v = JSON.parse(localStorage.getItem(SESSION_KEY) ?? '{}');
    return v && typeof v === 'object' ? v : {};
  } catch { return {}; }
}
function saveSession(s: Record<string, number>) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch { /* storage unavailable */ }
}

const LIMIT = 50;

export function StockCountPage() {
  const qc = useQueryClient();
  // Tab and toggles stay as you left them after a refresh.
  const [tab, setTab] = useStickyState<Tab>('stockcount:tab', 'RAW', { allowed: ['RAW', 'SLAB'] });
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search);
  const [page, setPage] = useState(1);
  const [includeZero, setIncludeZero] = useStickyState('stockcount:includeZero', false);
  const [hideCounted, setHideCounted] = useStickyState('stockcount:hideCounted', false);
  const [session, setSession] = useState<Record<string, number>>(loadSession);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [resetOpen, setResetOpen] = useState(false);
  // Only the row just counted gets the stamp animation, not every ticked row on load.
  const [justCounted, setJustCounted] = useState<string | null>(null);

  // Raw: omit inStock to include qty 0. Slabs: the API defaults to in-stock,
  // so including qty 0 needs an explicit inStock=false.
  const params = {
    // Most expensive first, so the high-value items get counted first.
    page, limit: LIMIT, search: debounced || undefined,
    sortBy: tab === 'RAW' ? 'postedPrice' : 'sellPrice', sortOrder: 'desc',
    inStock: includeZero ? (tab === 'SLAB' ? false : undefined) : true,
  };

  const query = useQuery({
    queryKey: [tab === 'RAW' ? 'raw-cards' : 'slabs', 'stock-count', params],
    queryFn: async () => {
      if (tab === 'RAW') {
        const res = await rawCardsService.list(params);
        return {
          meta: res.meta,
          rows: res.data.map<Row>((c) => ({
            key: `RAW:${c.id}`, itemType: 'RAW', id: c.id, name: c.name,
            sub: [c.cardNumber, c.rarity, c.setName].filter(Boolean).join(' · '),
            qty: c.quantity, graded: false, image: c.images?.[0]?.url,
          })),
        };
      }
      const res = await slabsService.list(params);
      return {
        meta: res.meta,
        rows: res.data.map<Row>((s) => ({
          key: `SLAB:${s.id}`, itemType: 'SLAB', id: s.id, name: s.name,
          sub: s.kind === 'SEALED'
            ? ['Sealed', s.setName].filter(Boolean).join(' · ')
            : [[s.gradingCompany, s.grade ? Number(s.grade) : null].filter(Boolean).join(' '),
               s.slabNumber ? `#${s.slabNumber}` : null].filter(Boolean).join(' · '),
          qty: s.quantity, graded: s.kind !== 'SEALED', image: s.images?.[0]?.url,
        })),
      };
    },
  });

  const markCounted = (key: string) => {
    setJustCounted(key);
    setSession((prev) => {
      const next = { ...prev, [key]: Date.now() };
      saveSession(next);
      return next;
    });
  };
  const clearCount = (key: string) => setCounts((prev) => {
    const next = { ...prev };
    delete next[key];
    return next;
  });

  const adjust = useMutation({
    mutationFn: (v: { row: Row; counted: number }) => stockCountService.adjust({
      itemType: v.row.itemType, id: v.row.id, expectedQty: v.row.qty, countedQty: v.counted,
    }),
    onSuccess: (_res, { row, counted }) => {
      markCounted(row.key);
      clearCount(row.key);
      toast.success(`${row.name}: ${row.qty} → ${counted}`);
      qc.invalidateQueries({ queryKey: [row.itemType === 'RAW' ? 'raw-cards' : 'slabs'] });
    },
    onError: (e, { row }) => {
      const err = apiError(e);
      toast.error(typeof err.message === 'string' ? err.message : 'Could not save count');
      if (err.code === 'STOCK_CHANGED') {
        clearCount(row.key);
        qc.invalidateQueries({ queryKey: [row.itemType === 'RAW' ? 'raw-cards' : 'slabs'] });
      }
    },
  });

  // A count that matches the system needs no write — just tick it off.
  const save = (row: Row, counted: number) => {
    if (counted === row.qty) { markCounted(row.key); clearCount(row.key); return; }
    adjust.mutate({ row, counted });
  };

  const rows = query.data?.rows ?? [];
  const visible = useMemo(
    () => (hideCounted ? rows.filter((r) => !session[r.key]) : rows),
    [rows, hideCounted, session],
  );
  const sessionTotal = Object.keys(session).length;
  const countedHere = rows.filter((r) => session[r.key]).length;

  const switchTab = (t: Tab) => { setTab(t); setPage(1); setCounts({}); };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader title="Stock Count"
        subtitle={`${sessionTotal} counted this session${query.data ? ` · ${countedHere}/${rows.length} on this page` : ''}`}
        actions={
          <Button variant="outline" size="sm" onClick={() => setResetOpen(true)} disabled={!sessionTotal}>
            <RotateCcw className="size-4" /> <span className="hidden sm:inline">New count</span>
          </Button>
        } />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex rounded-md border p-0.5">
          <Button size="sm" variant={tab === 'RAW' ? 'default' : 'ghost'} onClick={() => switchTab('RAW')}>Raw</Button>
          <Button size="sm" variant={tab === 'SLAB' ? 'default' : 'ghost'} onClick={() => switchTab('SLAB')}>Slabs & Sealed</Button>
        </div>
        <div className="relative w-full sm:w-72 sm:flex-none">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search name or card #…" className="pl-9" aria-label="Search" />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={hideCounted} onCheckedChange={setHideCounted} /> Hide counted
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={includeZero} onCheckedChange={(v) => { setIncludeZero(v); setPage(1); }} /> Include qty 0
        </label>
      </div>

      <Card className="flex min-h-0 flex-1 flex-col">
        {query.isLoading ? <TableSkeleton />
        : query.isError ? <ErrorState />
        : !rows.length ? <EmptyState message="No items match." />
        : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto">
              {!visible.length && <EmptyState message="Everything on this page is counted." />}
              {visible.map((row) => {
                const counted = counts[row.key] ?? row.qty;
                const delta = counted - row.qty;
                const done = !!session[row.key];
                const pending = adjust.isPending && adjust.variables?.row.key === row.key;
                const setCount = (n: number) => setCounts((p) => ({ ...p, [row.key]: Math.max(0, n) }));
                return (
                  <div key={row.key}
                    className={cn('flex flex-col gap-2 border-b px-3 py-2.5 sm:flex-row sm:items-center sm:px-4', done && 'bg-success/5')}>
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <CardThumb url={row.image} alt={row.name} className="aspect-[63/88] w-[38px]" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{row.name}</div>
                        <div className="truncate text-xs text-muted-foreground">{row.sub}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          <span>System: <span className="tabular-nums">{row.qty}</span></span>
                          {delta !== 0 && <Badge variant={delta > 0 ? 'info' : 'warning'}>{delta > 0 ? '+' : ''}{delta}</Badge>}
                          {done && <Badge variant="success" className={row.key === justCounted ? 'gl-stamp' : undefined}><Check className="size-3" /> Counted</Badge>}
                        </div>
                      </div>
                    </div>
                    {row.graded ? (
                      <Button size="sm" variant={done ? 'subtle' : 'outline'} className="h-10 self-end sm:self-auto"
                        onClick={() => markCounted(row.key)} disabled={done}>
                        <Check className="size-4" /> Found
                      </Button>
                    ) : (
                      <div className="flex shrink-0 items-center gap-1.5 self-end sm:self-auto">
                        <Button variant="outline" size="icon" className="h-10 w-10" aria-label="Decrease"
                          onClick={() => setCount(counted - 1)} disabled={pending || counted <= 0}><Minus /></Button>
                        <Input type="number" inputMode="numeric" min={0} value={counted} aria-label="Counted quantity"
                          onChange={(e) => setCount(parseInt(e.target.value, 10) || 0)}
                          className="h-10 w-14 text-center tabular-nums" disabled={pending} />
                        <Button variant="outline" size="icon" className="h-10 w-10" aria-label="Increase"
                          onClick={() => setCount(counted + 1)} disabled={pending}><Plus /></Button>
                        <Button size="icon" className="h-10 w-10" variant={delta !== 0 ? 'default' : 'outline'}
                          aria-label={delta !== 0 ? 'Save count' : 'Matches — mark counted'}
                          onClick={() => save(row, counted)} disabled={pending}>
                          {pending ? <Loader2 className="animate-spin" /> : <Check />}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center border-t">
              <Pagination page={page} totalPages={query.data!.meta.totalPages}
                total={query.data!.meta.total} onPage={setPage} />
            </div>
          </div>
        )}
      </Card>

      <ConfirmDialog open={resetOpen} onOpenChange={setResetOpen}
        title="Start a new count?"
        description="Clears the 'Counted' ticks on this device. Saved stock adjustments are not undone."
        confirmLabel="Start new count"
        onConfirm={() => { setSession({}); saveSession({}); setCounts({}); setResetOpen(false); }} />
    </div>
  );
}
