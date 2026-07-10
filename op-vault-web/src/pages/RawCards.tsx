import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search, PackagePlus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/common/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { CardThumb } from '@/components/common/CardImage';
import { Pagination } from '@/components/common/Pagination';
import { TableSkeleton, ErrorState, EmptyState } from '@/components/common/DataState';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { RawCardForm } from '@/features/raw-cards/RawCardForm';
import { RestockDialog } from '@/features/raw-cards/RestockDialog';
import { useRawCards, useRawCardMutations, RARITIES } from '@/features/raw-cards/use-raw-cards';
import { useAuth } from '@/contexts/auth-context';
import { peso } from '@/lib/utils';
import { apiError } from '@/lib/api';
import type { RawCard, StockStatus } from '@/types';
import { rawCardsService } from '@/services';
import { useBulkRun } from '@/features/raw-cards/use-bulk-run';

const statusBadge = (s: StockStatus) =>
  s === 'AVAILABLE' ? <Badge variant="success">Available</Badge>
  : s === 'LOW' ? <Badge variant="warning">Low</Badge>
  : s === 'SOLD' ? <Badge>Sold</Badge> : <Badge variant="destructive">Out</Badge>;

export function RawCardsPage() {
  const { isOwner } = useAuth();
  const [sp, setSp] = useSearchParams();
  const [search, setSearch] = useState(sp.get('search') ?? '');
  const [status, setStatus] = useState('');
  const [rarity, setRarity] = useState('');
  const [sort, setSort] = useState('createdAt:desc');
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const [editCard, setEditCard] = useState<RawCard | null>(null);
  const [restockCard, setRestockCard] = useState<RawCard | null>(null);
  const [deleteCard, setDeleteCard] = useState<RawCard | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [sortBy, sortOrder] = sort.split(':');
  const query = useRawCards({
    search: search || undefined, status: status || undefined, rarity: rarity || undefined,
    sortBy, sortOrder, page, limit: 15,
  });
  const { remove } = useRawCardMutations();

  const rows = query.data?.data ?? [];
  const allSelected = rows.length > 0 && rows.every((c) => selected.has(c.id));
  const someSelected = rows.some((c) => selected.has(c.id));

  const toggleOne = (id: string) => setSelected((prev) => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const toggleAll = () => setSelected((prev) => {
    const n = new Set(prev);
    if (allSelected) rows.forEach((c) => n.delete(c.id));
    else rows.forEach((c) => n.add(c.id));
    return n;
  });
  const clearSelection = () => setSelected(new Set());

  // --- Bulk actions ---
  const { run: bulkRun, progress: bulkProgress } = useBulkRun(['raw-cards']);
  const [bulkOp, setBulkOp] = useState('inc_pct');
  const [bulkVal, setBulkVal] = useState('');
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const selectedRows = useMemo(() => rows.filter((c) => selected.has(c.id)), [rows, selected]);

  const nextPrice = (current: number, op: string, v: number): number => {
    let p = current;
    if (op === 'inc_pct') p = current * (1 + v / 100);
    else if (op === 'dec_pct') p = current * (1 - v / 100);
    else if (op === 'inc_amt') p = current + v;
    else if (op === 'dec_amt') p = current - v;
    else if (op === 'set') p = v;
    return Math.max(0, Math.round(p)); // whole pesos, never negative
  };

  const applyBulkPrice = async () => {
    const v = Number(bulkVal);
    if (!Number.isFinite(v)) { toast.error('Enter a number'); return; }
    if (!selectedRows.length) return;
    await bulkRun(
      selectedRows,
      (c) => rawCardsService.update(c.id, { postedPrice: nextPrice(Number(c.postedPrice), bulkOp, v) }),
      { label: 'cards' },
    );
    setBulkVal('');
  };

  const applyBulkDelete = async () => {
    setBulkDeleteOpen(false);
    const ids = [...selected];
    await bulkRun(
      rows.filter((c) => selected.has(c.id)),
      (c) => rawCardsService.remove(c.id),
      { label: 'cards' },
    );
    setSelected((prev) => { const n = new Set(prev); ids.forEach((id) => n.delete(id)); return n; });
  };

  const onSearch = (e: React.FormEvent) => { e.preventDefault(); setPage(1); setSp(search ? { search } : {}); };
  const confirmDelete = async () => {
    if (!deleteCard) return;
    try { await remove.mutateAsync(deleteCard.id); toast.success('Card deleted'); setDeleteCard(null); }
    catch (e) { toast.error(apiError(e).message); }
  };

  return (
    <div>
      <PageHeader title="Raw Cards" subtitle={query.data ? `${query.data.meta.total} titles` : undefined}
        actions={<Button onClick={() => setShowAdd(true)}><Plus className="size-4" /> Add raw card</Button>} />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <form onSubmit={onSearch} className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, number, set…" className="pl-9" />
        </form>
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">All status</option><option value="AVAILABLE">Available</option><option value="LOW">Low</option><option value="OUT">Out</option></Select>
        <Select value={rarity} onChange={(e) => { setRarity(e.target.value); setPage(1); }}><option value="">All rarities</option>{RARITIES.map((r) => <option key={r} value={r}>{r}</option>)}</Select>
        <Select value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="createdAt:desc">Recently added</option>
          <option value="name:asc">Name A–Z</option><option value="name:desc">Name Z–A</option>
          <option value="postedPrice:desc">Price high→low</option><option value="postedPrice:asc">Price low→high</option>
          <option value="quantity:desc">Qty high→low</option><option value="quantity:asc">Qty low→high</option>
        </Select>
      </div>

      {selected.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-2.5">
          <span className="text-[13px] font-semibold">{selected.size} selected</span>
          <div className="mx-1 h-5 w-px bg-border" />

          <Select value={bulkOp} onChange={(e) => setBulkOp(e.target.value)} className="h-8" aria-label="Bulk price operation">
            <option value="inc_pct">Increase %</option>
            <option value="dec_pct">Decrease %</option>
            <option value="inc_amt">Increase ₱</option>
            <option value="dec_amt">Decrease ₱</option>
            <option value="set">Set price ₱</option>
          </Select>
          <Input value={bulkVal} onChange={(e) => setBulkVal(e.target.value)} type="number" placeholder="Value" className="h-8 w-24" />
          <Button size="sm" onClick={applyBulkPrice} disabled={bulkProgress.running || !bulkVal}>
            {bulkProgress.running ? <><Loader2 className="size-4 animate-spin" /> {bulkProgress.done}/{bulkProgress.total}</> : 'Apply price'}
          </Button>

          <div className="mx-1 h-5 w-px bg-border" />
          {isOwner && (
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setBulkDeleteOpen(true)} disabled={bulkProgress.running}>
              <Trash2 className="size-4" /> Delete selected
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={clearSelection} disabled={bulkProgress.running}>Clear</Button>
        </div>
      )}

      <Card>
        {query.isLoading ? <TableSkeleton />
        : query.isError ? <ErrorState message="Failed to load raw cards." />
        : !query.data?.data.length ? <EmptyState message="No cards match your filters." />
        : (
          <>
            <Table>
              <THead><TR>
                <TH className="w-8">
                  <input type="checkbox" aria-label="Select all on page"
                    checked={allSelected} ref={(el) => { if (el) el.indeterminate = !allSelected && someSelected; }}
                    onChange={toggleAll} className="size-4 cursor-pointer align-middle" />
                </TH>
                <TH>Card</TH><TH>Set</TH><TH>Rarity</TH><TH className="text-right">Qty</TH>
                <TH className="text-right">Cost</TH><TH className="text-right">Price</TH><TH>Status</TH><TH></TH>
              </TR></THead>
              <TBody>
                {query.data.data.map((c) => (
                  <TR key={c.id} data-selected={selected.has(c.id) || undefined}>
                    <TD className="w-8">
                      <input type="checkbox" aria-label={`Select ${c.name}`}
                        checked={selected.has(c.id)} onChange={() => toggleOne(c.id)}
                        className="size-4 cursor-pointer align-middle" />
                    </TD>
                    <TD>
                      <div className="flex items-center gap-2.5">
                        <CardThumb url={c.images?.[0]?.url} alt={c.name} className="h-[46px] w-[34px]" />
                        <div><div className="font-medium">{c.name}</div><div className="text-xs text-muted-foreground">{c.cardNumber}</div></div>
                      </div>
                    </TD>
                    <TD>{c.setName}</TD>
                    <TD><span className="rounded border bg-muted px-1.5 py-0.5 text-[11px] font-bold text-muted-foreground">{c.rarity}</span></TD>
                    <TD className="text-right tnum">{c.quantity}</TD>
                    <TD className="text-right tnum">{peso(c.buyCost)}</TD>
                    <TD className="text-right font-semibold tnum">{peso(c.postedPrice)}</TD>
                    <TD>{statusBadge(c.status)}</TD>
                    <TD>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setRestockCard(c)}><PackagePlus className="size-4" /> Qty</Button>
                        <Button variant="ghost" size="icon" onClick={() => setEditCard(c)} aria-label="Edit"><Pencil className="size-4" /></Button>
                        {isOwner && <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeleteCard(c)} aria-label="Delete"><Trash2 className="size-4" /></Button>}
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <Pagination page={page} totalPages={query.data.meta.totalPages} total={query.data.meta.total} onPage={setPage} />
          </>
        )}
      </Card>

      <RawCardForm open={showAdd} onOpenChange={setShowAdd} />
      <RawCardForm open={!!editCard} onOpenChange={(o) => !o && setEditCard(null)} editing={editCard} />
      <RestockDialog card={restockCard} onClose={() => setRestockCard(null)} />
      <ConfirmDialog open={!!deleteCard} onOpenChange={(o) => !o && setDeleteCard(null)}
        title="Delete this card?" description={deleteCard ? `${deleteCard.name} (${deleteCard.cardNumber}) will be permanently removed.` : ''}
        destructive confirmLabel="Delete" loading={remove.isPending} onConfirm={confirmDelete} />
      <ConfirmDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}
        title={`Delete ${selected.size} cards?`} description="The selected cards on this page will be permanently removed. This cannot be undone."
        destructive confirmLabel="Delete all" loading={bulkProgress.running} onConfirm={applyBulkDelete} />
    </div>
  );
}
