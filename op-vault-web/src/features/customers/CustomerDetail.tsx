import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/DataState';
import { peso, fmtDate } from '@/lib/utils';
import { saleVariant } from '@/lib/status';
import { useCustomerPurchases, useCustomerStats } from './use-customers';
import type { Customer } from '@/types';

export function CustomerDetail({ customer, onOpenChange }: { customer: Customer | null; onOpenChange: (o: boolean) => void }) {
  const { data: stats, isLoading: statsLoading } = useCustomerStats(customer?.id);
  const { data: purchases, isLoading: purchasesLoading } = useCustomerPurchases(customer?.id);

  const stat = (label: string, value: string) => (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-[11px] font-semibold text-muted-foreground">{label}</div>
      {statsLoading ? <Skeleton className="mt-1.5 h-6 w-20" /> : <div className="mt-1 text-lg font-bold tabular-nums">{value}</div>}
    </div>
  );

  return (
    <Dialog open={!!customer} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{customer?.name}</DialogTitle></DialogHeader>
        <div className="mb-4 flex flex-wrap gap-3 text-sm text-muted-foreground">
          {customer?.facebookName && <span>FB: {customer.facebookName}</span>}
          {customer?.contactNumber && <span>· {customer.contactNumber}</span>}
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stat('Lifetime spend', peso(stats?.totalSpent ?? 0))}
          {stat('Total orders', String(stats?.totalOrders ?? 0))}
          {stat('Profit generated', peso(stats?.totalProfit ?? 0))}
          {stat('Last purchase', stats?.lastPurchaseAt ? fmtDate(stats.lastPurchaseAt) : '—')}
        </div>

        <h4 className="mb-2 text-sm font-semibold">Purchase history</h4>
        <div className="max-h-72 overflow-y-auto rounded-lg border">
          {purchasesLoading ? <div className="space-y-2 p-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
            : !purchases?.length ? <EmptyState message="No purchases yet." />
            : (
              <Table>
                <THead><TR><TH>Reference</TH><TH>Date</TH><TH className="text-right">Total</TH><TH className="text-right">Profit</TH><TH>Status</TH></TR></THead>
                <TBody>
                  {purchases.map((s) => (
                    <TR key={s.id}>
                      <TD className="font-semibold">{s.reference}</TD>
                      <TD>{fmtDate(s.createdAt)}</TD>
                      <TD className="text-right tabular-nums">{peso(s.grandTotal)}</TD>
                      <TD className="text-right tabular-nums text-success">{peso(s.totalProfit)}</TD>
                      <TD><Badge variant={saleVariant(s.status)}>{s.status}</Badge></TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
