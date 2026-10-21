import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, RefreshCw, ExternalLink, Loader2, Check, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/common/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { CardThumb } from '@/components/common/CardImage';
import { Pagination } from '@/components/common/Pagination';
import { TableSkeleton, ErrorState, EmptyState } from '@/components/common/DataState';
import { useAuth } from '@/contexts/auth-context';
import { useDebounce } from '@/hooks/use-debounce';
import { apiError } from '@/lib/api';
import { cn, peso } from '@/lib/utils';
import { marketPricesService, type MarketRow } from '@/services';

const yen = (n: number) => `¥${n.toLocaleString('ja-JP')}`;
const when = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'never';

export function MarketPricesPage() {
  const { isOwner } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search);
  const [underpricedOnly, setUnderpricedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [linking, setLinking] = useState<MarketRow | null>(null);

  const params = { page, limit: 25, search: debounced || undefined, underpricedOnly: underpricedOnly || undefined };
  const query = useQuery({ queryKey: ['market-prices', params], queryFn: () => marketPricesService.list(params) });
  const summary = query.data?.summary;

  // Poll sync progress only while a sync is running.
  const status = useQuery({
    queryKey: ['market-sync-status'],
    queryFn: marketPricesService.status,
    refetchInterval: (q) => (q.state.data?.running ? 3000 : false),
  });
  const sync = status.data ?? summary?.sync;
  const wasRunning = useRef(false);
  useEffect(() => {
    if (wasRunning.current && sync && !sync.running) {
      qc.invalidateQueries({ queryKey: ['market-prices'] });
      toast.success(`Price sync finished: ${sync.done - sync.failed}/${sync.total} card numbers updated`);
    }
    wasRunning.current = !!sync?.running;
  }, [sync?.running]); // eslint-disable-line react-hooks/exhaustive-deps

  const startSync = useMutation({
    mutationFn: marketPricesService.sync,
    onSuccess: (s) => qc.setQueryData(['market-sync-status'], s),
    onError: (e) => toast.error(apiError(e).message),
  });

  const lastRun = summary?.lastRun;
  const subtitle = summary
    ? `${summary.underpriced} underpriced · ${summary.matched} of ${summary.cards} in-stock cards matched · last sync ${when(lastRun?.finishedAt)}`
    : undefined;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader title="Market Prices" subtitle={subtitle}
        actions={isOwner && (
          <Button size="sm" variant="outline" onClick={() => startSync.mutate()} disabled={!!sync?.running || startSync.isPending}>
            {sync?.running
              ? <><Loader2 className="size-4 animate-spin" /> Syncing {sync.done}/{sync.total}</>
              : <><RefreshCw className="size-4" /> Sync now</>}
          </Button>
        )} />

      {summary && !summary.rate && (
        <Card className="mb-3 flex flex-wrap items-center justify-between gap-2 border-warning/40 bg-warning/5 p-3 text-sm">
          <span>Set the yen to peso rate to compare prices. Yuyu-tei prices are shown in yen until then.</span>
          {isOwner && <Button asChild size="sm" variant="outline"><Link to="/settings">Open Settings</Link></Button>}
        </Card>
      )}
      {lastRun && lastRun.failed > 0 && !sync?.running && (
        <p className="mb-2 text-xs text-muted-foreground">
          Last sync couldn’t reach Yuyu-tei for {lastRun.failed} card number{lastRun.failed === 1 ? '' : 's'}
          {lastRun.lastError ? ` (e.g. ${lastRun.lastError})` : ''}. Those keep their previous prices.
        </p>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72 sm:flex-none">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search name or card #…" className="pl-9" aria-label="Search" />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={underpricedOnly} onCheckedChange={(v) => { setUnderpricedOnly(v); setPage(1); }} />
          Underpriced only
        </label>
      </div>

      <Card className="flex min-h-0 flex-1 flex-col">
        {query.isLoading ? <TableSkeleton />
        : query.isError ? <ErrorState />
        : !query.data?.data.length
          ? <EmptyState message={underpricedOnly ? 'Nothing is underpriced right now.' : summary?.matched ? 'No cards match your search.' : 'No prices yet. Run a sync to fetch Yuyu-tei prices.'} />
        : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto">
              {query.data.data.map((row) => (
                <PriceRow key={row.id} row={row} rate={summary?.rate ?? null} canEdit={isOwner} onChange={() => setLinking(row)} />
              ))}
            </div>
            <div className="flex items-center border-t">
              <Pagination page={page} totalPages={query.data.meta.totalPages} total={query.data.meta.total} onPage={setPage} />
            </div>
          </div>
        )}
      </Card>

      <LinkDialog row={linking} rate={summary?.rate ?? null} onClose={() => setLinking(null)} />
    </div>
  );
}

function PriceRow({ row, rate, canEdit, onChange }: { row: MarketRow; rate: number | null; canEdit: boolean; onChange: () => void }) {
  const l = row.listing;
  return (
    <div className={cn('flex flex-col gap-2 border-b px-3 py-3 sm:flex-row sm:items-center sm:px-4', row.underpriced && 'bg-warning/5')}>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <CardThumb url={row.imageUrl} alt={row.name} className="aspect-[63/88] w-[38px]" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{row.name}</div>
          <div className="truncate text-xs text-muted-foreground">{row.cardNumber} · {row.rarity} · qty {row.quantity}</div>
          <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            {l ? (
              <>
                <span className="truncate" title={l.name}>{l.manual ? (l.viaLink ? 'Linked by you' : 'Matched by you') : 'Auto match'}: {l.name}</span>
                {!l.inStock && <span className="shrink-0">· sold out there</span>}
                <a href={l.url} target="_blank" rel="noreferrer" className="shrink-0 hover:text-foreground" aria-label="Open on Yuyu-tei">
                  <ExternalLink className="size-3.5" />
                </a>
              </>
            ) : <span>{row.candidateCount ? 'No automatic match' : 'Not found on Yuyu-tei yet'}</span>}
            {canEdit && (
              <button type="button" onClick={onChange} className="shrink-0 font-medium text-foreground underline-offset-2 hover:underline">
                {l || row.candidateCount ? 'Change' : 'Paste link'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-end justify-between gap-4 pl-[50px] text-right sm:pl-0">
        <div>
          <div className="text-[11px] text-muted-foreground">Your price</div>
          <div className="text-sm font-semibold tabular-nums">{peso(row.postedPrice)}</div>
        </div>
        <div>
          <div className="text-[11px] text-muted-foreground">Yuyu-tei</div>
          <div className="text-sm font-semibold tabular-nums">
            {l ? (rate && row.marketPhp !== null ? peso(row.marketPhp) : yen(l.priceJpy)) : '—'}
          </div>
          {l && rate && <div className="text-[11px] tabular-nums text-muted-foreground">{yen(l.priceJpy)}</div>}
        </div>
        <div className="w-[92px]">
          {row.diffPct !== null && (
            <Badge variant={row.underpriced ? 'warning' : row.diffPct < 0 ? 'default' : 'success'} className="tabular-nums">
              {row.diffPct > 0 ? '+' : ''}{row.diffPct}%
            </Badge>
          )}
          {row.underpriced && <div className="mt-1 text-[11px] font-semibold text-warning">Underpriced</div>}
        </div>
      </div>
    </div>
  );
}

function LinkDialog({ row, rate, onClose }: { row: MarketRow | null; rate: number | null; onClose: () => void }) {
  const qc = useQueryClient();
  const listings = useQuery({
    queryKey: ['market-listings', row?.cardNumber],
    queryFn: () => marketPricesService.listings(row!.cardNumber),
    enabled: !!row,
  });
  const link = useMutation({
    mutationFn: (key: string | null) => marketPricesService.link(row!.id, key),
    onSuccess: (_r, key) => {
      toast.success(key ? 'Match updated' : 'Back to automatic match');
      qc.invalidateQueries({ queryKey: ['market-prices'] });
      onClose();
    },
    onError: (e) => toast.error(apiError(e).message),
  });
  const current = row?.listing;
  const [url, setUrl] = useState('');
  useEffect(() => { if (!row) setUrl(''); }, [row]);
  const linkUrl = useMutation({
    mutationFn: () => marketPricesService.linkUrl(row!.id, url.trim()),
    onSuccess: (l) => {
      toast.success(`Linked: ${l.name}`);
      qc.invalidateQueries({ queryKey: ['market-prices'] });
      onClose();
    },
    onError: (e) => toast.error(apiError(e).message),
  });
  const busy = link.isPending || linkUrl.isPending;

  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Match {row?.cardNumber} {row?.rarity}</DialogTitle>
          <DialogDescription>Pick the Yuyu-tei listing that matches the printing you have, or paste its link.</DialogDescription>
        </DialogHeader>
        <form className="mb-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (url.trim()) linkUrl.mutate(); }}>
          <div className="relative min-w-0 flex-1">
            <Link2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={url} onChange={(e) => setUrl(e.target.value)} disabled={busy} inputMode="url"
              placeholder="https://yuyu-tei.jp/sell/opc/card/…" className="pl-9" aria-label="Yuyu-tei card link" />
          </div>
          <Button type="submit" disabled={busy || !url.trim()}>
            {linkUrl.isPending ? <Loader2 className="size-4 animate-spin" /> : 'Use link'}
          </Button>
        </form>
        {current?.viaLink && current.manual && (
          <p className="mb-2 text-xs text-muted-foreground">Currently linked to <a href={current.url} target="_blank" rel="noreferrer" className="underline">{current.name}</a>.</p>
        )}
        <div className="max-h-[50vh] space-y-1.5 overflow-y-auto">
          <OptionButton selected={!!current && !current.manual} disabled={busy} onClick={() => link.mutate(null)}>
            <div className="text-sm font-medium">Automatic</div>
            <div className="text-xs text-muted-foreground">Original printing with the same rarity</div>
          </OptionButton>
          {listings.isLoading && <TableSkeleton rows={3} />}
          {listings.data?.map((l) => (
            <OptionButton key={l.listingKey} selected={!!current?.manual && current.listingKey === l.listingKey}
              disabled={busy} onClick={() => link.mutate(l.listingKey)}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium">{l.name}</div>
                  <div className="text-xs text-muted-foreground">{l.rarity} · {l.listingKey.split('/')[0].toUpperCase()} · {l.inStock ? `${l.stockCount ?? ''} in stock` : 'sold out'}</div>
                </div>
                <div className="shrink-0 text-right text-sm font-semibold tabular-nums">
                  {yen(l.priceJpy)}
                  {rate && <div className="text-[11px] font-normal text-muted-foreground">≈ {peso(Math.round(l.priceJpy * rate))}</div>}
                </div>
              </div>
            </OptionButton>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function OptionButton({ selected, disabled, onClick, children }: {
  selected: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={cn('relative w-full rounded-md border p-2.5 pr-8 text-left transition-colors hover:bg-muted disabled:opacity-60',
        selected && 'border-primary bg-muted')}>
      {children}
      {selected && <Check className="absolute right-2.5 top-3 size-4" />}
    </button>
  );
}
