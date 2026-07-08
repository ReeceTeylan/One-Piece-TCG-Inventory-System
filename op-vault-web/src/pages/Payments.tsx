import { useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/common/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { TableSkeleton, ErrorState, EmptyState } from '@/components/common/DataState';
import { Pagination } from '@/components/common/Pagination';
import { SearchInput } from '@/components/common/Toolbar';
import { peso, pesoF, fmtDate } from '@/lib/utils';
import { saleVariant, PAYMENT_METHODS } from '@/lib/status';
import { useDebounce } from '@/hooks/use-debounce';
import { apiError } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { paymentsService } from '@/services';
import { useSales } from '@/features/sales/use-sales';
import type { Sale } from '@/types';

export function PaymentsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debounced = useDebounce(search);
  // Outstanding balances = partial + unpaid sales
  const { data, isLoading, isError } = useSales({ page, limit: 20, search: debounced || undefined, status: 'PARTIAL' });
  const { data: unpaid } = useSales({ page: 1, limit: 50, status: 'UNPAID' });
  const [target, setTarget] = useState<Sale | null>(null);

  const rows = [...(data?.data ?? []), ...(page === 1 ? unpaid?.data ?? [] : [])];

  return (
    <>
      <PageHeader title="Payments" subtitle="Outstanding balances & payment history" />
      <div className="mb-3.5 flex items-center gap-2.5">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search reference, customer…" />
      </div>
      <Card>
        {isLoading ? <TableSkeleton /> : isError ? <ErrorState /> : !rows.length ? <EmptyState message="No outstanding balances." /> : (
          <Table>
            <THead><TR><TH>Reference</TH><TH>Customer</TH><TH className="text-right">Total</TH><TH className="text-right">Paid</TH><TH className="text-right">Balance</TH><TH>Status</TH><TH>Date</TH><TH></TH></TR></THead>
            <TBody>
              {rows.map((s) => {
                const balance = Number(s.grandTotal) - Number(s.amountPaid);
                return (
                  <TR key={s.id}>
                    <TD className="font-semibold">{s.reference}</TD>
                    <TD>{s.customer?.name ?? '—'}</TD>
                    <TD className="text-right tabular-nums">{peso(s.grandTotal)}</TD>
                    <TD className="text-right tabular-nums">{peso(s.amountPaid)}</TD>
                    <TD className="text-right font-semibold tabular-nums text-warning">{peso(balance)}</TD>
                    <TD><Badge variant={saleVariant(s.status)}>{s.status}</Badge></TD>
                    <TD>{fmtDate(s.createdAt)}</TD>
                    <TD className="text-right"><Button size="sm" onClick={() => setTarget(s)}>Add payment</Button></TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
        {data && data.meta.totalPages > 1 && <Pagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} onPage={setPage} />}
      </Card>
      <PaymentDialog sale={target} onOpenChange={(o) => !o && setTarget(null)} />
    </>
  );
}

function PaymentDialog({ sale, onOpenChange }: { sale: Sale | null; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const { data: detail, isLoading } = useQuery({
    queryKey: ['payments', sale?.id], queryFn: () => paymentsService.forSale(sale!.id), enabled: !!sale,
  });
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('CASH');
  const add = useMutation({
    mutationFn: () => paymentsService.add(sale!.id, { amount: Number(amount), method }),
    onSuccess: () => {
      toast.success('Payment recorded');
      qc.invalidateQueries({ queryKey: ['payments', sale?.id] });
      qc.invalidateQueries({ queryKey: ['sales'] });
      setAmount('');
    },
    onError: (e) => toast.error(apiError(e).message),
  });

  return (
    <Dialog open={!!sale} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Payments · {sale?.reference}</DialogTitle></DialogHeader>
        {isLoading ? <div className="py-6 text-center text-sm text-muted-foreground">Loading…</div> : detail && (
          <>
            <div className="mb-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg border p-2"><div className="text-[11px] text-muted-foreground">Total</div><div className="font-bold tabular-nums">{peso(detail.grandTotal)}</div></div>
              <div className="rounded-lg border p-2"><div className="text-[11px] text-muted-foreground">Paid</div><div className="font-bold tabular-nums">{peso(detail.amountPaid)}</div></div>
              <div className="rounded-lg border p-2"><div className="text-[11px] text-muted-foreground">Balance</div><div className="font-bold tabular-nums text-warning">{peso(detail.remainingBalance)}</div></div>
            </div>
            <div className="mb-3 max-h-40 overflow-y-auto rounded-lg border">
              {detail.payments.length ? detail.payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between border-b px-3 py-2 text-sm last:border-0">
                  <span>{p.method} · {fmtDate(p.createdAt)}</span><b className="tabular-nums">{pesoF(p.amount)}</b>
                </div>
              )) : <p className="px-3 py-4 text-center text-sm text-muted-foreground">No payments yet</p>}
            </div>
            {detail.remainingBalance > 0 && (
              <div className="flex items-end gap-2">
                <div className="flex-1"><Label>Amount (₱)</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1" max={detail.remainingBalance} /></div>
                <div><Label>Method</Label><Select value={method} onChange={(e) => setMethod(e.target.value)} className="mt-1 w-full">{PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}</Select></div>
              </div>
            )}
          </>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
          {detail && detail.remainingBalance > 0 && <Button onClick={() => add.mutate()} disabled={add.isPending || !amount}>{add.isPending ? 'Saving…' : 'Record payment'}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
