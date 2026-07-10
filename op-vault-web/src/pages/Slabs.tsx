import { useState } from 'react';
import { Plus, Upload, Pencil, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/common/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { TableSkeleton, ErrorState, EmptyState } from '@/components/common/DataState';
import { Pagination } from '@/components/common/Pagination';
import { CardThumb } from '@/components/common/CardImage';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { SearchInput } from '@/components/common/Toolbar';
import { peso } from '@/lib/utils';
import { stockVariant, stockLabel } from '@/lib/status';
import { useDebounce } from '@/hooks/use-debounce';
import { useAuth } from '@/contexts/auth-context';
import { apiError } from '@/lib/api';
import type { SlabCard } from '@/types';
import { useSlabs, useSlabMutations, GRADES } from '@/features/slabs/use-slabs';
import { SlabForm } from '@/features/slabs/SlabForm';

export function SlabsPage() {
  const { isOwner } = useAuth();
  const { remove, upload } = useSlabMutations();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [grade, setGrade] = useState('');
  const [sort, setSort] = useState('createdAt:desc');
  const [page, setPage] = useState(1);
  const debounced = useDebounce(search);
  const [sortBy, sortOrder] = sort.split(':');

  const { data, isLoading, isError } = useSlabs({
    page, limit: 20, search: debounced || undefined, status: status || undefined,
    grade: grade || undefined, sortBy, sortOrder,
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SlabCard | null>(null);
  const [toDelete, setToDelete] = useState<SlabCard | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const rows = data?.data ?? [];
  const allSelected = rows.length > 0 && rows.every((s) => selected.has(s.id));
  const someSelected = rows.some((s) => selected.has(s.id));
  const toggleOne = (id: string) => setSelected((prev) => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const toggleAll = () => setSelected((prev) => {
    const n = new Set(prev);
    if (allSelected) rows.forEach((s) => n.delete(s.id));
    else rows.forEach((s) => n.add(s.id));
    return n;
  });
  const clearSelection = () => setSelected(new Set());

  const openImage = (id: string) => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (file) {
        try { await upload.mutateAsync({ file, id }); toast.success('Image uploaded'); }
        catch (e) { toast.error(apiError(e).message); }
      }
    };
    input.click();
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    try { await remove.mutateAsync(toDelete.id); toast.success('Slab deleted'); setToDelete(null); }
    catch (e) { toast.error(apiError(e).message); }
  };

  return (
    <>
      <PageHeader title="Slab Inventory" subtitle={`${data?.meta.total ?? 0} graded cards`}
        actions={<Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus /> Add slab</Button>} />

      <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search name, cert #, set…" />
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All status</option><option value="AVAILABLE">Available</option><option value="SOLD">Sold</option>
        </Select>
        <Select value={grade} onChange={(e) => { setGrade(e.target.value); setPage(1); }}>
          <option value="">All grades</option>{GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
        </Select>
        <Select value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="createdAt:desc">Recently added</option>
          <option value="name:asc">Name A–Z</option>
          <option value="sellPrice:desc">Price high→low</option>
          <option value="sellPrice:asc">Price low→high</option>
          <option value="grade:desc">Grade high→low</option>
        </Select>
      </div>

      {selected.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-2.5">
          <span className="text-[13px] font-semibold">{selected.size} selected</span>
          <Button size="sm" variant="ghost" onClick={clearSelection}>Clear selection</Button>
          <span className="text-xs text-muted-foreground">Bulk actions coming next…</span>
        </div>
      )}

      <Card>
        {isLoading ? <TableSkeleton /> : isError ? <ErrorState /> : !data?.data.length ? <EmptyState message="No slabs match your filters." /> : (
          <Table>
            <THead><TR>
              <TH className="w-8">
                <input type="checkbox" aria-label="Select all on page"
                  checked={allSelected} ref={(el) => { if (el) el.indeterminate = !allSelected && someSelected; }}
                  onChange={toggleAll} className="size-4 cursor-pointer align-middle" />
              </TH>
              <TH>Slab</TH><TH>Company</TH><TH>Cert #</TH><TH className="text-right">Grade</TH>
              <TH className="text-right">Cost</TH><TH className="text-right">Price</TH><TH>Status</TH><TH></TH>
            </TR></THead>
            <TBody>
              {data.data.map((s) => (
                <TR key={s.id} data-selected={selected.has(s.id) || undefined}>
                  <TD className="w-8">
                    <input type="checkbox" aria-label={`Select ${s.name}`}
                      checked={selected.has(s.id)} onChange={() => toggleOne(s.id)}
                      className="size-4 cursor-pointer align-middle" />
                  </TD>
                  <TD>
                    <div className="flex items-center gap-3">
                      <CardThumb url={s.images?.[0]?.url} alt={s.name} className="h-[52px] w-[38px]" />
                      <div><b className="font-semibold">{s.name}</b><span className="block text-[11.5px] text-muted-foreground">{s.setName || '—'}</span></div>
                    </div>
                  </TD>
                  <TD><span className="rounded border bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">{s.gradingCompany}</span></TD>
                  <TD className="tabular-nums">{s.slabNumber}</TD>
                  <TD className="text-right"><Badge variant="info">{Number(s.grade)}</Badge></TD>
                  <TD className="text-right tabular-nums">{peso(s.buyCost)}</TD>
                  <TD className="text-right font-semibold tabular-nums">{peso(s.sellPrice)}</TD>
                  <TD><Badge variant={s.status === 'SOLD' ? 'default' : stockVariant(s.status)}>{s.status === 'SOLD' ? 'Sold' : stockLabel(s.status)}</Badge></TD>
                  <TD>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openImage(s.id)} aria-label="Upload image"><Upload /></Button>
                      <Button variant="ghost" size="icon" onClick={() => { setEditing(s); setFormOpen(true); }} aria-label="Edit"><Pencil /></Button>
                      {isOwner && <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setToDelete(s)} aria-label="Delete"><Trash2 /></Button>}
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
        {data && data.meta.totalPages > 1 && <Pagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} onPage={setPage} />}
      </Card>

      <SlabForm open={formOpen} onOpenChange={setFormOpen} editing={editing} />
      <ConfirmDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)} destructive
        title="Delete slab" description={`Delete "${toDelete?.name}" (cert ${toDelete?.slabNumber})? This cannot be undone.`}
        confirmLabel="Delete" loading={remove.isPending} onConfirm={confirmDelete} />
    </>
  );
}
