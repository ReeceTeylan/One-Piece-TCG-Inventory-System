import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search, PackagePlus, Pencil, Trash2 } from 'lucide-react';
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

  const [sortBy, sortOrder] = sort.split(':');
  const query = useRawCards({
    search: search || undefined, status: status || undefined, rarity: rarity || undefined,
    sortBy, sortOrder, page, limit: 15,
  });
  const { remove } = useRawCardMutations();

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

      <Card>
        {query.isLoading ? <TableSkeleton />
        : query.isError ? <ErrorState message="Failed to load raw cards." />
        : !query.data?.data.length ? <EmptyState message="No cards match your filters." />
        : (
          <>
            <Table>
              <THead><TR>
                <TH>Card</TH><TH>Set</TH><TH>Rarity</TH><TH className="text-right">Qty</TH>
                <TH className="text-right">Cost</TH><TH className="text-right">Price</TH><TH>Status</TH><TH></TH>
              </TR></THead>
              <TBody>
                {query.data.data.map((c) => (
                  <TR key={c.id}>
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
    </div>
  );
}
