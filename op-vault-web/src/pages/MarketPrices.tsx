import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, RefreshCw, ExternalLink, Loader2, Check, Link2, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/common/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select } from '@/components/ui/select';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { CardThumb } from '@/components/common/CardImage';
import { Pagination } from '@/components/common/Pagination';
import { TableSkeleton, ErrorState, EmptyState } from '@/components/common/DataState';
import { useAuth } from '@/contexts/auth-context';
import { useDebounce } from '@/hooks/use-debounce';
import { apiError } from '@/lib/api';
import { cn, peso } from '@/lib/utils';
import { marketPricesService, type MarketRow, type MarketSort, type MarketSource, type MarketSummary } from '@/services';

const yen = (n: number) => `¥${n.toLocaleString('ja-JP')}`;
const usd = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const foreign = (price: number, currency: 'JPY' | 'USD') => (currency === 'USD' ? usd(price) : yen(price));
const SOURCE_NAME: Record<MarketSource, string> = { YUYUTEI: 'Yuyu-tei', DORASUTA: 'Dorasuta', TCGPLAYER: 'TCGplayer' };
// Where this row's price comes from: its listing's shop, else the default for its language.
const sourceName = (row: MarketRow) => (row.listing ? SOURCE_NAME[row.listing.source] : row.language === 'EN' ? 'TCGplayer' : 'Yuyu-tei');
const when = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'never';

export function MarketPricesPage() {
  const { isOwner } = useAuth();
  const qc = useQueryClient();
  const [sp] = useSearchParams();
  // ?search= lets the dashboard's Market movers open straight to a card.
  const [search, setSearch] = useState(() => sp.get('search') ?? '');
  const debounced = useDebounce(search);
  const [underpricedOnly, setUnderpricedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [linking, setLinking] = useState<MarketRow | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [view, setView] = useState<'changes' | 'all'>('changes');
  const [sort, setSort] = useState<MarketSort | ''>(''); // '' = default for the view
  const [language, setLanguage] = useState<'' | 'JP' | 'EN'>('');
  const [condition, setCondition] = useState<'' | 'clean' | 'issues'>('');
  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1); };

  const params = {
    page, limit: 25, search: debounced || undefined, underpricedOnly: underpricedOnly || undefined,
    view, sort: sort || undefined, language: language || undefined, condition: condition || undefined,
  };
  // Keep showing the current list while the next filter/page loads (no blank flash).
  const query = useQuery({
    queryKey: ['market-prices', params],
    queryFn: () => marketPricesService.list(params),
    placeholderData: keepPreviousData,
  });
  const summary = query.data?.summary;
  // Preload the next page so "Next" opens instantly.
  const totalPages = query.data?.meta.totalPages ?? 1;
  useEffect(() => {
    if (query.isPlaceholderData || page >= totalPages) return;
    const next = { ...params, page: page + 1 };
    qc.prefetchQuery({ queryKey: ['market-prices', next], queryFn: () => marketPricesService.list(next) });
  }, [query.data, page, totalPages]); // eslint-disable-line react-hooks/exhaustive-deps

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
      toast.success(`Price sync finished: ${sync.done - sync.failed}/${sync.total} steps updated`);
    }
    wasRunning.current = !!sync?.running;
  }, [sync?.running]); // eslint-disable-line react-hooks/exhaustive-deps

  const startSync = useMutation({
    mutationFn: marketPricesService.sync,
    onSuccess: (s) => qc.setQueryData(['market-sync-status'], s),
    onError: (e) => toast.error(apiError(e).message),
  });

  const refreshAfterPriceChange = () => {
    qc.invalidateQueries({ queryKey: ['market-prices'] });
    qc.invalidateQueries({ queryKey: ['raw-cards'] });
  };
  const matchOne = useMutation({
    mutationFn: (row: MarketRow) => marketPricesService.match(row.id),
    onSuccess: (r, row) => {
      toast.success(r.changed ? `${row.name}: ${peso(r.from)} → ${peso(r.to)}` : `${row.name} already matches`);
      refreshAfterPriceChange();
    },
    onError: (e) => toast.error(apiError(e).message),
  });
  const matchAll = useMutation({
    mutationFn: marketPricesService.matchAllUnderpriced,
    onSuccess: (r) => {
      toast.success(r.updated ? `Raised ${r.updated} card${r.updated === 1 ? '' : 's'} to market price` : 'Nothing to update');
      setConfirmAll(false);
      refreshAfterPriceChange();
    },
    onError: (e) => toast.error(apiError(e).message),
  });

  const lastRun = summary?.lastRun;
  const subtitle = summary
    ? `${summary.underpriced} underpriced · ${summary.matched} of ${summary.cards} in-stock cards matched · last sync ${when(lastRun?.finishedAt)}`
    : undefined;
  const missingRates = summary ? missingRateNames(summary) : [];
  const toRaise = summary?.matchableUnderpriced ?? 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader title="Market Prices" subtitle={subtitle}
        actions={isOwner && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setConfirmAll(true)} disabled={!toRaise || matchAll.isPending}>
              <ArrowUpRight className="size-4" /> Match all underpriced{toRaise ? ` (${toRaise})` : ''}
            </Button>
            <Button size="sm" variant="outline" onClick={() => startSync.mutate()} disabled={!!sync?.running || startSync.isPending}>
              {sync?.running
                ? <><Loader2 className="size-4 animate-spin" /> {sync.phase === 'tcgplayer' ? 'TCGplayer' : sync.phase === 'dorasuta' ? 'Dorasuta' : 'Yuyu-tei'} {sync.done}/{sync.total}</>
                : <><RefreshCw className="size-4" /> Sync now</>}
            </Button>
          </div>
        )} />

      {missingRates.length > 0 && (
        <Card className="mb-3 flex flex-wrap items-center justify-between gap-2 border-warning/40 bg-warning/5 p-3 text-sm">
          <span>Not set yet: {missingRates.join(', ')}. Cards using a missing rate show the foreign price only.</span>
          {isOwner && <Button asChild size="sm" variant="outline"><Link to="/settings">Open Settings</Link></Button>}
        </Card>
      )}
      {lastRun && lastRun.failed > 0 && !sync?.running && (
        <p className="mb-2 text-xs text-muted-foreground">
          Last sync couldn’t update {lastRun.failed} item{lastRun.failed === 1 ? '' : 's'}
          {lastRun.lastError ? ` (e.g. ${lastRun.lastError})` : ''}. Those keep their previous prices.
        </p>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72 sm:flex-none">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search name or card #…" className="pl-9" aria-label="Search" />
        </div>
        <Select value={view} onChange={(e) => { reset(setView)(e.target.value as 'changes' | 'all'); setSort(''); }} aria-label="Show">
          <option value="changes">Price changes (last day){summary ? ` · ${summary.changed}` : ''}</option>
          <option value="all">All in-stock cards</option>
        </Select>
        <Select value={sort} onChange={(e) => reset(setSort)(e.target.value as MarketSort | '')} aria-label="Sort">
          <option value="">{view === 'changes' ? 'Biggest change' : 'Most underpriced'}</option>
          {view !== 'changes' && <option value="change">Biggest change</option>}
          <option value="price_desc">Most expensive</option>
          <option value="price_asc">Least expensive</option>
          <option value="recent">Recently added</option>
          <option value="margin_desc">Biggest margin</option>
          {view === 'changes' && <option value="underpriced">Most underpriced</option>}
        </Select>
        <Select value={language} onChange={(e) => reset(setLanguage)(e.target.value as '' | 'JP' | 'EN')} aria-label="Language">
          <option value="">All languages</option>
          <option value="JP">Japanese</option>
          <option value="EN">English</option>
        </Select>
        <Select value={condition} onChange={(e) => reset(setCondition)(e.target.value as '' | 'clean' | 'issues')} aria-label="Condition">
          <option value="">All conditions</option>
          <option value="clean">Clean</option>
          <option value="issues">With issues</option>
        </Select>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={underpricedOnly} onCheckedChange={(v) => { setUnderpricedOnly(v); setPage(1); }} />
          Underpriced only
        </label>
      </div>

      <Card className={cn('flex min-h-0 flex-1 flex-col transition-opacity', query.isPlaceholderData && 'opacity-60')}>
        {query.isLoading ? <TableSkeleton />
        : query.isError ? <ErrorState />
        : !query.data?.data.length
          ? (view === 'changes' && !underpricedOnly && !search && !language && !condition
              ? <div className="flex flex-col items-center">
                  <EmptyState message={summary?.lastRun ? 'No market prices moved since the last sync.' : 'No prices yet. Run a sync to fetch market prices.'} />
                  <Button size="sm" variant="outline" className="-mt-6 mb-8" onClick={() => { setView('all'); setSort(''); setPage(1); }}>Show all cards</Button>
                </div>
              : <EmptyState message={underpricedOnly ? 'Nothing is underpriced right now.' : 'No cards match these filters.'} />)
        : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto">
              {query.data.data.map((row) => (
                <PriceRow key={row.id} row={row} canEdit={isOwner}
                  onChange={() => setLinking(row)}
                  onMatch={() => matchOne.mutate(row)}
                  matching={matchOne.isPending && matchOne.variables?.id === row.id} />
              ))}
            </div>
            <div className="flex items-center border-t">
              <Pagination page={page} totalPages={query.data.meta.totalPages} total={query.data.meta.total} onPage={setPage} />
            </div>
          </div>
        )}
      </Card>

      <LinkDialog row={linking} onClose={() => setLinking(null)} />
      <ConfirmDialog open={confirmAll} onOpenChange={setConfirmAll}
        title={`Raise ${toRaise} card${toRaise === 1 ? '' : 's'} to market price?`}
        description="Every underpriced in-stock card gets its posted price set to the market price, rounded to the nearest ₱10 (₱100 from ₱5,000). Each change is saved in price history and the activity log."
        confirmLabel="Raise prices" loading={matchAll.isPending} onConfirm={() => matchAll.mutate()} />
    </div>
  );
}

/** Main rates only; a missing damaged rate is flagged on the affected card instead. */
function missingRateNames(s: MarketSummary): string[] {
  const out: string[] = [];
  if (!s.rate) out.push('₱ per ¥1');
  if (!s.usdRate) out.push('₱ per $1');
  return out;
}

function PriceRow({ row, canEdit, onChange, onMatch, matching }: {
  row: MarketRow; canEdit: boolean; onChange: () => void; onMatch: () => void; matching: boolean;
}) {
  const l = row.listing;
  const lower = row.matchPrice !== null && row.matchPrice < row.postedPrice;
  return (
    <div className={cn('flex flex-col gap-2 border-b px-3 py-3 sm:flex-row sm:items-center sm:px-4', row.underpriced && 'bg-warning/5')}>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <CardThumb url={row.imageUrl} alt={row.name} className="aspect-[63/88] w-[38px]" />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-sm font-medium">{row.name}</span>
            {row.language === 'EN' && <Badge variant="info" className="shrink-0">English</Badge>}
            {row.damage && (
              <Badge variant="warning" className="shrink-0" title={row.damagedRateMissing ? 'Damaged rate not set — using the normal rate' : 'Priced at the damaged rate'}>
                {row.damage}{row.damagedRateMissing ? ' · rate not set' : ''}
              </Badge>
            )}
          </div>
          <div className="truncate text-xs text-muted-foreground">{row.cardNumber} · {row.rarity} · qty {row.quantity}</div>
          <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            {l ? (
              <>
                <span className="truncate" title={l.name}>
                  {l.manual ? (l.viaLink ? 'Linked by you' : 'Matched by you') : 'Auto match'}{l.source === 'DORASUTA' ? ' (Dorasuta)' : ''}: {l.name}
                </span>
                {l.inStock === false && <span className="shrink-0">· sold out there</span>}
                <a href={l.url} target="_blank" rel="noreferrer" className="shrink-0 hover:text-foreground" aria-label={`Open on ${sourceName(row)}`}>
                  <ExternalLink className="size-3.5" />
                </a>
              </>
            ) : <span>{row.unlinked ? 'No market price (match removed)' : row.candidateCount ? 'No automatic match' : `Not found on ${sourceName(row)} yet`}</span>}
            {canEdit && (row.language === 'JP' || row.candidateCount > 0 || row.unlinked) && (
              <button type="button" onClick={onChange} className="shrink-0 font-medium text-foreground underline-offset-2 hover:underline">
                {l || row.candidateCount || row.unlinked ? 'Change' : 'Paste link'}
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
          <div className="text-[11px] text-muted-foreground">{sourceName(row)}</div>
          <div className="text-sm font-semibold tabular-nums">
            {l ? (row.marketPhp !== null ? peso(row.marketPhp) : foreign(l.price, l.currency)) : '—'}
          </div>
          {l && row.marketPhp !== null && <div className="text-[11px] tabular-nums text-muted-foreground">{foreign(l.price, l.currency)}</div>}
          {row.changePhp !== null && l?.prevPrice != null && (
            <div className={cn('text-[11px] font-semibold tabular-nums', row.changePhp > 0 ? 'text-success' : 'text-destructive')}
              title={`Was ${foreign(l.prevPrice, l.currency)} before the last sync`}>
              {row.changePhp > 0 ? '▲' : '▼'} {peso(Math.abs(row.changePhp))}
            </div>
          )}
          {row.marginPct !== null && <div className="text-[11px] tabular-nums text-muted-foreground">Margin {row.marginPct}%</div>}
        </div>
        <div className="w-[92px]">
          {row.diffPct !== null && (
            <Badge variant={row.underpriced ? 'warning' : row.diffPct < 0 ? 'default' : 'success'} className="tabular-nums">
              {row.diffPct > 0 ? '+' : ''}{row.diffPct}%
            </Badge>
          )}
          {row.underpriced && <div className="mt-1 text-[11px] font-semibold text-warning">Underpriced</div>}
          {canEdit && row.matchPrice !== null && (
            <Button size="sm" variant={row.underpriced ? 'default' : 'outline'} className="mt-1.5 h-7 w-full px-2 text-[11px]"
              onClick={onMatch} disabled={matching} title={`Set your price to ${peso(row.matchPrice)}`}>
              {matching ? <Loader2 className="size-3.5 animate-spin" />
                : <>{lower ? <ArrowDownRight className="size-3.5" /> : <ArrowUpRight className="size-3.5" />} {peso(row.matchPrice)}</>}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function LinkDialog({ row, onClose }: { row: MarketRow | null; onClose: () => void }) {
  const qc = useQueryClient();
  const isEnglish = row?.language === 'EN';
  // Japanese cards: Yuyu-tei is the main shop, Dorasuta the backup. English: TCGplayer only.
  const [tab, setTab] = useState<MarketSource>('YUYUTEI');
  useEffect(() => {
    if (row) setTab(row.language === 'EN' ? 'TCGPLAYER' : row.listing?.source === 'DORASUTA' ? 'DORASUTA' : 'YUYUTEI');
  }, [row]);
  const listings = useQuery({
    queryKey: ['market-listings', row?.cardNumber, tab],
    queryFn: () => marketPricesService.listings(row!.cardNumber, tab),
    enabled: !!row && (tab === 'TCGPLAYER') === isEnglish,
  });
  const link = useMutation({
    mutationFn: (key: string | null) => marketPricesService.link(row!.id, key),
    onSuccess: (_r, key) => {
      toast.success(key === 'none' ? 'Match removed. This card has no market price now.' : key ? 'Match updated' : 'Back to automatic match');
      qc.invalidateQueries({ queryKey: ['market-prices'] });
      qc.invalidateQueries({ queryKey: ['card-market'] });
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
      qc.invalidateQueries({ queryKey: ['card-market'] });
      onClose();
    },
    onError: (e) => toast.error(apiError(e).message),
  });
  const busy = link.isPending || linkUrl.isPending;
  const rate = row?.rateUsed ?? null;
  const isAuto = !!row && !row.unlinked && !current?.manual;

  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Match {row?.cardNumber} {row?.rarity}{isEnglish ? ' (English)' : ''}</DialogTitle>
          <DialogDescription>
            {isEnglish
              ? 'Pick the TCGplayer product that matches the printing you have.'
              : 'Pick the listing that matches the printing you have, or paste a Yuyu-tei or Dorasuta card link.'}
          </DialogDescription>
        </DialogHeader>
        {!isEnglish && (
          <form className="mb-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (url.trim()) linkUrl.mutate(); }}>
            <div className="relative min-w-0 flex-1">
              <Link2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={url} onChange={(e) => setUrl(e.target.value)} disabled={busy} inputMode="url"
                placeholder="Yuyu-tei or Dorasuta card link" className="pl-9" aria-label="Card link" />
            </div>
            <Button type="submit" disabled={busy || !url.trim()}>
              {linkUrl.isPending ? <Loader2 className="size-4 animate-spin" /> : 'Use link'}
            </Button>
          </form>
        )}
        {current?.manual && (
          <p className="mb-2 text-xs text-muted-foreground">Currently matched to <a href={current.url} target="_blank" rel="noreferrer" className="underline">{current.name}</a> on {SOURCE_NAME[current.source]}.</p>
        )}
        <div className="mb-2 space-y-1.5">
          <OptionButton selected={isAuto} disabled={busy} onClick={() => link.mutate(null)}>
            <div className="text-sm font-medium">Automatic</div>
            <div className="text-xs text-muted-foreground">
              {isEnglish ? 'Original printing with the same rarity' : 'Yuyu-tei first; Dorasuta when Yuyu-tei doesn\'t list this card'}
            </div>
          </OptionButton>
          <OptionButton selected={!!row?.unlinked} disabled={busy} onClick={() => link.mutate('none')}>
            <div className="text-sm font-medium">No market price</div>
            <div className="text-xs text-muted-foreground">Remove the match if it&apos;s wrong and the shop doesn&apos;t sell this card. Counted at 80% of your price.</div>
          </OptionButton>
        </div>
        {!isEnglish && (
          <div className="mb-2 flex gap-1 rounded-md border bg-muted p-0.5" role="tablist">
            {(['YUYUTEI', 'DORASUTA'] as const).map((t) => (
              <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
                className={cn('flex-1 rounded px-3 py-1 text-xs font-semibold', tab === t ? 'bg-card shadow-sm' : 'text-muted-foreground')}>
                {SOURCE_NAME[t]}
              </button>
            ))}
          </div>
        )}
        <div className="max-h-[42vh] space-y-1.5 overflow-y-auto">
          {listings.isLoading && <TableSkeleton rows={3} />}
          {listings.data && !listings.data.length && (
            <p className="py-4 text-center text-sm text-muted-foreground">{SOURCE_NAME[tab]} has no listings for {row?.cardNumber}.</p>
          )}
          {listings.isError && <p className="py-4 text-center text-sm text-muted-foreground">Couldn&apos;t load {SOURCE_NAME[tab]} right now. Try again in a moment.</p>}
          {listings.data?.map((l) => (
            <OptionButton key={l.listingKey} selected={!!current?.manual && current.listingKey === l.listingKey}
              disabled={busy} onClick={() => link.mutate(l.listingKey)}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium">{l.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {[l.rarity, l.source === 'DORASUTA' ? null : l.setLabel, l.inStock === null ? null : l.inStock ? `${l.stockCount ?? ''} in stock` : 'sold out'].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <div className="shrink-0 text-right text-sm font-semibold tabular-nums">
                  {foreign(l.price, l.currency)}
                  {rate && <div className="text-[11px] font-normal text-muted-foreground">≈ {peso(Math.round(l.price * rate))}</div>}
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
