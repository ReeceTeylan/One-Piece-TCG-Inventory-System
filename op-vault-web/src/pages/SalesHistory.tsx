import { useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/common/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { TableSkeleton, ErrorState, EmptyState } from '@/components/common/DataState';
import { Pagination } from '@/components/common/Pagination';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { SearchInput } from '@/components/common/Toolbar';
import { cn } from '@/lib/utils';
import { peso, fmtDate } from '@/lib/utils';
import { saleVariant } from '@/lib/status';
import { useDebounce } from '@/hooks/use-debounce';
import { useAuth } from '@/contexts/auth-context';
import { apiError } from '@/lib/api';
import type { Sale } from '@/types';
import { useSales, useSaleMutations } from '@/features/sales/use-sales';
import { EditOrderDialog } from '@/features/sales/EditOrderDialog';

const RANGES = ['today', 'week', 'month', 'year'] as const;

export function SalesHistoryPage() {
  const { isOwner } = useAuth();
  const { cancel, refund } = useSaleMutations();
  const [search, setSearch] = useState('');
  const [range, setRange] = useState<string>('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const debounced = useDebounce(search);
  const { data, isLoading, isError } = useSales({ page, limit: 20, search: debounced || undefined, range: range || undefined, status: status || undefined });

  const [action, setAction] = useState<{ type: 'cancel' | 'refund'; sale: Sale } | null>(null);
  const [editSale, setEditSale] = useState<Sale | null>(null);

  const runAction = async () => {
    if (!action) return;
    try {
      // Fixed: Added the required 'reason' property
      if (action.type === 'cancel') await cancel.mutateAsync({ id: action.sale.id, reason: 'Cancelled by user' });
      else await refund.mutateAsync({ id: action.sale.id, reason: 'Refunded by user' });
      toast.success(`Sale ${action.type === 'cancel' ? 'cancelled' : 'refunded'}`);
      setAction(null);
    } catch (e) { toast.error(apiError(e).message); }
  };

  return (
    <>
      <PageHeader title="Sales History" subtitle={`${data?.meta.total ?? 0} transactions`} />
      <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search reference, customer…" />
        <div className="flex gap-1 rounded-lg border bg-muted p-0.5">
          <button onClick={() => { setRange(''); setPage(1); }} className={cn('rounded-md px-3 py-1 text-xs font-semibold', !range ? 'bg-card shadow' : 'text-muted-foreground')}>All</button>
          {RANGES.map((r) => (
            <button key={r} onClick={() => { setRange(r); setPage(1); }} className={cn('rounded-md px-3 py-1 text-xs font-semibold capitalize', range === r ? 'bg-card shadow' : 'text-muted-foreground')}>{r}</button>
          ))}
        </div>
        <select className="h-9 rounded-md border bg-card px-3 text-sm" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All status</option><option value="PAID">Paid</option><option value="PARTIAL">Partial</option><option value="UNPAID">Unpaid</option><option value="CANCELLED">Cancelled</option><option value="REFUNDED">Refunded</option>
        </select>
      </div>

      <Card>
        {isLoading ? <TableSkeleton /> : isError ? <ErrorState /> : !data?.data.length ? <EmptyState message="No sales found." /> : (
          <Table>
            <THead><TR>
              <TH>Reference</TH><TH>Customer</TH><TH className="text-right">Total</TH><TH className="text-right">Profit</TH>
              <TH>Date</TH><TH>Status</TH><TH>Shipping</TH><TH></TH>
            </TR></THead>
            <TBody>
              {data.data.map((s) => (
                <TR key={s.id}>
                  <TD className="font-semibold">{s.reference}</TD>
                  <TD>{s.customer?.name ?? '—'}</TD>
                  <TD className="text-right font-semibold tabular-nums">{peso(s.grandTotal)}</TD>
                  <TD className="text-right tabular-nums text-success">{peso(s.totalProfit)}</TD>
                  <TD>{fmtDate(s.createdAt)}</TD>
                  <TD><Badge variant={saleVariant(s.status)}>{s.status}</Badge></TD>
                  <TD className="text-muted-foreground">{s.shipment?.courier ?? '—'}</TD>
                  <TD>
                    <div className="flex justify-end gap-1">
                      {isOwner && s.status !== 'CANCELLED' && s.status !== 'REFUNDED' && (
                        <>
                          <Button variant="outline" size="sm" onClick={() => setEditSale(s)}>Edit</Button>
                          <Button variant="ghost" size="sm" onClick={() => setAction({ type: 'cancel', sale: s })}>Cancel</Button>
                          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setAction({ type: 'refund', sale: s })}>Refund</Button>
                        </>
                      )}
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
        {data && data.meta.totalPages > 1 && <Pagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} onPage={setPage} />}
      </Card>

      <ConfirmDialog open={!!action} onOpenChange={(o) => !o && setAction(null)} destructive={action?.type === 'refund'}
        title={action?.type === 'cancel' ? 'Cancel sale' : 'Refund sale'}
        description={`${action?.type === 'cancel' ? 'Cancel' : 'Refund'} ${action?.sale?.reference}? Inventory will be restored.`}
        confirmLabel={action?.type === 'cancel' ? 'Cancel sale' : 'Refund'} loading={cancel.isPending || refund.isPending} onConfirm={runAction} />

      <EditOrderDialog 
        sale={editSale} 
        open={!!editSale} 
        onOpenChange={(open) => !open && setEditSale(null)} 
        onSuccess={() => setEditSale(null)} 
      />
    </>
  );
}