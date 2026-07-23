import { useState } from 'react';
import { Truck, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
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
import { peso, fmtDate } from '@/lib/utils';
import { shipVariant, shipLabel, COURIERS } from '@/lib/status';
import { apiError } from '@/lib/api';
import { salesService } from '@/services';
import { CardThumb } from '@/components/common/CardImage';
import { useShipmentImages } from '@/features/shipments/use-shipment-images';
import type { Shipment } from '@/types';
import { useShipments, useShipmentMutations, useShipmentTimeline, NEXT_STATUS } from '@/features/shipments/use-shipments';

const STATUSES = ['TO_PACK', 'READY', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

export function ShipmentsPage() {
  const [status, setStatus] = useState('PENDING');
  const [courier, setCourier] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useShipments({
    page, limit: 20,
    status: status === 'PENDING' || status === '' ? undefined : status,
    pending: status === 'PENDING' ? true : undefined,
    courier: courier || undefined,
  });
  const [detail, setDetail] = useState<Shipment | null>(null);

  return (
    <>
      <PageHeader title="Shipments" subtitle="Fulfillment queue & tracking" />
      <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="PENDING">To pack &amp; Ready</option>
          <option value="">All status</option>
          {STATUSES.map((s) => <option key={s} value={s}>{shipLabel(s as any)}</option>)}
        </Select>
        <Select value={courier} onChange={(e) => { setCourier(e.target.value); setPage(1); }}>
          <option value="">All couriers</option>{COURIERS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </Select>
      </div>

      <Card>
        {isLoading ? <TableSkeleton /> : isError ? <ErrorState /> : !data?.data.length ? <EmptyState message="No shipments." /> : (
          <Table>
            <THead><TR><TH>Reference</TH><TH>Customer</TH><TH>Courier</TH><TH className="text-right">Value</TH><TH>Tracking</TH><TH>Status</TH><TH>Date</TH><TH></TH></TR></THead>
            <TBody>
              {data.data.map((s) => (
                <TR key={s.id} className="cursor-pointer" onClick={() => setDetail(s)}>
                  <TD className="font-semibold">{s.sale?.reference ?? '—'}</TD>
                  <TD>{s.sale?.customer?.name ?? '—'}</TD>
                  <TD>{COURIERS.find((c) => c.value === s.courier)?.label ?? s.courier}</TD>
                  <TD className="text-right tabular-nums">{peso(s.totalValue)}</TD>
                  <TD className="tabular-nums text-muted-foreground">{s.trackingNumber || '—'}</TD>
                  <TD><Badge variant={shipVariant(s.status)}>{shipLabel(s.status)}</Badge></TD>
                  <TD>{fmtDate(s.createdAt)}</TD>
                  <TD onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" onClick={() => setDetail(s)} aria-label="Details"><Truck /></Button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
        {data && data.meta.totalPages > 1 && <Pagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} onPage={setPage} />}
      </Card>

      <ShipmentDetail shipment={detail} onOpenChange={(o) => !o && setDetail(null)} />
    </>
  );
}

function ShipmentDetail({ shipment, onOpenChange }: { shipment: Shipment | null; onOpenChange: (o: boolean) => void }) {
  const { update } = useShipmentMutations();
  const { data: timeline } = useShipmentTimeline(shipment?.id);
  const { data: sale } = useQuery({
    queryKey: ['shipment-sale', shipment?.saleId],
    queryFn: () => salesService.get(shipment!.saleId),
    enabled: !!shipment?.saleId,
  });
  const { items: photoItems, loading: photosLoading } = useShipmentImages(sale);
  const [tracking, setTracking] = useState('');
  const [courier, setCourier] = useState('');

  const next = shipment ? NEXT_STATUS[shipment.status] : null;
  const advance = async () => {
    if (!shipment || !next) return;
    try {
      await update.mutateAsync({ id: shipment.id, dto: { status: next, trackingNumber: tracking || shipment.trackingNumber || undefined, courier: courier || undefined } });
      toast.success(`Moved to ${shipLabel(next as any)}`);
      onOpenChange(false); setTracking(''); setCourier('');
    } catch (e) { toast.error(apiError(e).message); }
  };
  const markDelivered = async () => {
    if (!shipment) return;
    try {
      await update.mutateAsync({ id: shipment.id, dto: { status: 'DELIVERED', trackingNumber: tracking || shipment.trackingNumber || undefined, courier: courier || undefined } });
      toast.success('Marked as delivered');
      onOpenChange(false); setTracking(''); setCourier('');
    } catch (e) { toast.error(apiError(e).message); }
  };
  const saveTracking = async () => {
    if (!shipment) return;
    try { await update.mutateAsync({ id: shipment.id, dto: { trackingNumber: tracking, courier: courier || undefined } }); toast.success('Updated'); }
    catch (e) { toast.error(apiError(e).message); }
  };

  return (
    <Dialog open={!!shipment} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-lg flex-col">
        <DialogHeader><DialogTitle>{shipment?.sale?.reference} · {shipment?.sale?.customer?.name}</DialogTitle></DialogHeader>
        {shipment && (
          <div className="-mr-2 flex-1 overflow-y-auto pr-2">
            <div className="mb-4 flex items-center gap-3">
              <Badge variant={shipVariant(shipment.status)}>{shipLabel(shipment.status)}</Badge>
              <span className="text-sm text-muted-foreground">Value {peso(shipment.totalValue)} · Fee {peso(shipment.shippingFee)}</span>
            </div>
            <div className="mb-4 grid grid-cols-2 gap-3">
              <div><Label>Courier</Label><Select value={courier || shipment.courier} onChange={(e) => setCourier(e.target.value)} className="mt-1 w-full">{COURIERS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</Select></div>
              <div><Label>Tracking number</Label><Input value={tracking || shipment.trackingNumber || ''} onChange={(e) => setTracking(e.target.value)} className="mt-1" /></div>
            </div>

            <h4 className="mb-2 text-sm font-semibold">Items to pack</h4>
            <div className="mb-4 rounded-lg border">
              {(photoItems.length ? photoItems : (shipment.items ?? []).map((it) => ({ id: it.id, name: it.nameSnapshot, quantity: it.quantity, imageUrl: undefined, meta: undefined }))).map((it) => (
                <div key={it.id} className="flex items-center gap-3 border-b px-3 py-2 last:border-0">
                  <CardThumb url={(it as any).imageUrl} alt={it.name} className="h-14 w-10 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">{it.name}</span>
                    {(it as any).meta && <span className="block text-[11px] text-muted-foreground">{(it as any).meta}</span>}
                  </div>
                  <b className="text-sm tabular-nums">×{it.quantity}</b>
                </div>
              ))}
              {photosLoading && <div className="px-3 py-2 text-[11px] text-muted-foreground">Loading card photos…</div>}
              {!photoItems.length && !shipment.items?.length && <p className="px-3 py-2 text-sm text-muted-foreground">—</p>}
            </div>

            <h4 className="mb-2 text-sm font-semibold">Timeline</h4>
            <div className="mb-2 space-y-2">
              {timeline?.length ? timeline.map((e: any) => (
                <div key={e.id} className="flex items-start gap-2.5">
                  <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
                  <div><b className="text-[13px]">{shipLabel(e.status)}</b>{e.note && <span className="block text-[11px] text-muted-foreground">{e.note}</span>}<span className="block text-[11px] text-muted-foreground">{fmtDate(e.createdAt)}</span></div>
                </div>
              )) : <p className="text-sm text-muted-foreground">No events yet.</p>}
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={saveTracking} disabled={update.isPending}>Save tracking</Button>
          {shipment && next && next !== 'DELIVERED' && shipment.status !== 'CANCELLED' && (
            <Button variant="outline" onClick={markDelivered} disabled={update.isPending}>Mark delivered</Button>
          )}
          {next && <Button onClick={advance} disabled={update.isPending}>Move to {shipLabel(next as any)} <ArrowRight /></Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
