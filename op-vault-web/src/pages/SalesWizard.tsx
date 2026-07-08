import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Trash2, Minus, ArrowRight, ArrowLeft, CheckCircle2, X } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/common/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { CardThumb } from '@/components/common/CardImage';
import { peso, pesoF } from '@/lib/utils';
import { COURIERS, PAYMENT_METHODS } from '@/lib/status';
import { apiError } from '@/lib/api';
import { useDebounce } from '@/hooks/use-debounce';
import { WizardSteps } from '@/features/sales/WizardSteps';
import { useSaleMutations, useProductSearch, useCustomerLookup } from '@/features/sales/use-sales';
import { CartLine, cartSubtotal, cartProfit, lineTotal } from '@/features/sales/cart';
import type { Customer } from '@/types';

export function SalesWizardPage() {
  const navigate = useNavigate();
  const { complete } = useSaleMutations();
  const [step, setStep] = useState(1);

  // customer
  const [existing, setExisting] = useState<Customer | null>(null);
  const [newCustomer, setNewCustomer] = useState({ name: '', facebookName: '', contactNumber: '' });
  const [custSearch, setCustSearch] = useState('');
  const custDebounced = useDebounce(custSearch);
  const { data: custResults } = useCustomerLookup(custDebounced);

  // order meta
  const [courier, setCourier] = useState('MEETUP');
  const [shippingFee, setShippingFee] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState('');

  // products
  const [prodSearch, setProdSearch] = useState('');
  const prodDebounced = useDebounce(prodSearch);
  const { raw, slabs } = useProductSearch(prodDebounced);
  const [cart, setCart] = useState<CartLine[]>([]);

  // payment
  const [paymentStatus, setPaymentStatus] = useState<'PAID' | 'PARTIAL' | 'UNPAID'>('PAID');
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState('CASH');

  const subtotal = useMemo(() => cartSubtotal(cart), [cart]);
  const profit = useMemo(() => cartProfit(cart) - discount, [cart, discount]);
  const grandTotal = subtotal - discount + Number(shippingFee || 0);

  const customerValid = !!existing || newCustomer.name.trim().length > 0;

  const addRaw = (c: any) => {
    setCart((prev) => {
      const found = prev.find((l) => l.itemType === 'RAW' && l.rawCardId === c.id);
      if (found) {
        if (found.quantity >= found.max) { toast.error('Reached available stock'); return prev; }
        return prev.map((l) => (l === found ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [...prev, {
        key: `raw-${c.id}`, itemType: 'RAW', rawCardId: c.id, name: c.name, sub: c.cardNumber,
        imageUrl: c.images?.[0]?.url, unitPrice: Number(c.postedPrice), unitCost: Number(c.buyCost), quantity: 1, max: c.quantity,
      }];
    });
  };
  const addSlab = (s: any) => {
    setCart((prev) => {
      if (prev.find((l) => l.itemType === 'SLAB' && l.slabId === s.id)) { toast.error('Slab already in cart'); return prev; }
      return [...prev, {
        key: `slab-${s.id}`, itemType: 'SLAB', slabId: s.id, name: s.name, sub: `${s.gradingCompany} ${Number(s.grade)}`,
        imageUrl: s.images?.[0]?.url, unitPrice: Number(s.sellPrice), unitCost: Number(s.buyCost), quantity: 1, max: 1,
      }];
    });
  };
  const setQty = (key: string, delta: number) =>
    setCart((prev) => prev.map((l) => l.key === key ? { ...l, quantity: Math.max(1, Math.min(l.max, l.quantity + delta)) } : l));
  const setPrice = (key: string, price: number) =>
    setCart((prev) => prev.map((l) => l.key === key ? { ...l, unitPrice: Math.max(0, price) } : l));
  const removeLine = (key: string) => setCart((prev) => prev.filter((l) => l.key !== key));

  const goProducts = () => { if (!customerValid) return toast.error('Select or enter a customer'); setStep(2); };
  const goSummary = () => { if (!cart.length) return toast.error('Add at least one product'); setAmountPaid(grandTotal); setStep(3); };

  const submit = async () => {
    const paid = paymentStatus === 'PAID' ? grandTotal : paymentStatus === 'UNPAID' ? 0 : Number(amountPaid);
    const dto = {
      ...(existing ? { customerId: existing.id } : { customer: newCustomer }),
      courier, shippingFee: Number(shippingFee || 0), discount: Number(discount || 0),
      amountPaid: paid, paymentMethod, notes: notes || undefined,
      items: cart.map((l) => ({
        itemType: l.itemType, rawCardId: l.rawCardId, slabId: l.slabId, quantity: l.quantity, unitPrice: l.unitPrice,
      })),
    };
    try {
      const sale = await complete.mutateAsync(dto);
      setStep(5);
      toast.success(`Sale ${sale.reference} completed`);
      setResult(sale);
    } catch (e) { toast.error(apiError(e).message); }
  };

  const [result, setResult] = useState<any>(null);

  const reset = () => {
    setStep(1); setExisting(null); setNewCustomer({ name: '', facebookName: '', contactNumber: '' });
    setCart([]); setDiscount(0); setShippingFee(0); setNotes(''); setResult(null); setPaymentStatus('PAID');
  };

  return (
    <>
      <PageHeader title="New Sale" subtitle="Customer-first checkout" />
      {step <= 4 && <WizardSteps step={step} />}

      {step === 1 && (
        <Card className="max-w-2xl p-5">
          <h3 className="mb-3 text-sm font-semibold">Select existing customer</h3>
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={custSearch} onChange={(e) => { setCustSearch(e.target.value); setExisting(null); }} placeholder="Search customers…" className="pl-9" />
          </div>
          {custSearch && !existing && (
            <div className="mb-4 max-h-44 overflow-y-auto rounded-lg border">
              {custResults?.data.length ? custResults.data.map((c) => (
                <button key={c.id} onClick={() => { setExisting(c); setCustSearch(c.name); }}
                  className="flex w-full items-center justify-between border-b px-3 py-2 text-left text-sm last:border-0 hover:bg-muted">
                  <span><b>{c.name}</b>{c.facebookName && <span className="text-muted-foreground"> · {c.facebookName}</span>}</span>
                  <span className="text-xs text-muted-foreground">{c._count?.sales ?? 0} orders</span>
                </button>
              )) : <p className="px-3 py-4 text-center text-sm text-muted-foreground">No matches — enter a new customer below.</p>}
            </div>
          )}
          {existing && (
            <div className="mb-4 flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
              <span>Selected: <b>{existing.name}</b></span>
              <Button variant="ghost" size="icon" onClick={() => { setExisting(null); setCustSearch(''); }}><X /></Button>
            </div>
          )}

          <div className="mb-3 border-t pt-4"><h3 className="mb-3 text-sm font-semibold">or create new customer</h3></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Name</Label><Input value={newCustomer.name} disabled={!!existing} onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })} className="mt-1" /></div>
            <div><Label>Facebook name</Label><Input value={newCustomer.facebookName} disabled={!!existing} onChange={(e) => setNewCustomer({ ...newCustomer, facebookName: e.target.value })} className="mt-1" /></div>
            <div><Label>Contact number</Label><Input value={newCustomer.contactNumber} disabled={!!existing} onChange={(e) => setNewCustomer({ ...newCustomer, contactNumber: e.target.value })} className="mt-1" /></div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 border-t pt-4">
            <div><Label>Shipping method</Label><Select value={courier} onChange={(e) => setCourier(e.target.value)} className="mt-1 w-full">{COURIERS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</Select></div>
            <div><Label>Shipping fee (₱)</Label><Input type="number" value={shippingFee} onChange={(e) => setShippingFee(Number(e.target.value))} className="mt-1" /></div>
            <div className="col-span-2"><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1" /></div>
          </div>
          <div className="mt-5 flex justify-end"><Button onClick={goProducts}>Continue to products <ArrowRight /></Button></div>
        </Card>
      )}

      {step === 2 && (
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Card className="p-5">
            <div className="relative mb-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={prodSearch} onChange={(e) => setProdSearch(e.target.value)} placeholder="Search raw cards or slabs…" className="pl-9" />
            </div>
            <div className="max-h-[420px] space-y-1.5 overflow-y-auto">
              {raw.data?.data.map((c) => (
                <ProductRow key={c.id} img={c.images?.[0]?.url} name={c.name} sub={`${c.cardNumber} · ${c.quantity} in stock`} price={c.postedPrice} onAdd={() => addRaw(c)} />
              ))}
              {slabs.data?.data.map((s) => (
                <ProductRow key={s.id} img={s.images?.[0]?.url} name={s.name} sub={`${s.gradingCompany} ${Number(s.grade)} · cert ${s.slabNumber}`} price={s.sellPrice} badge="SLAB" onAdd={() => addSlab(s)} />
              ))}
              {(raw.isLoading || slabs.isLoading) && <div className="flex justify-center py-6"><Spinner /></div>}
              {!raw.isLoading && !slabs.isLoading && !raw.data?.data.length && !slabs.data?.data.length && (
                <p className="py-8 text-center text-sm text-muted-foreground">No available items match.</p>
              )}
            </div>
          </Card>
          <Card className="flex flex-col p-5">
            <h3 className="mb-2 text-sm font-semibold">Cart <span className="text-muted-foreground">· {cart.length} item(s)</span></h3>
            <div className="flex-1 space-y-2 overflow-y-auto">
              {cart.length ? cart.map((l) => (
                <div key={l.key} className="flex items-center gap-2.5 border-b py-2 last:border-0">
                  <CardThumb url={l.imageUrl} alt={l.name} className="h-10 w-[30px]" />
                  <div className="min-w-0 flex-1"><b className="block truncate text-[13px]">{l.name}</b><span className="text-[11px] text-muted-foreground">{l.sub} · {peso(l.unitPrice)}</span></div>
                  <b className="tabular-nums text-[13px]">×{l.quantity}</b>
                  <Button variant="ghost" size="icon" onClick={() => removeLine(l.key)} aria-label="Remove"><Trash2 /></Button>
                </div>
              )) : <p className="py-10 text-center text-sm text-muted-foreground">Cart is empty</p>}
            </div>
            <div className="mt-3 flex gap-2">
              <Button variant="ghost" onClick={() => setStep(1)}><ArrowLeft /> Customer</Button>
              <Button className="flex-1" onClick={goSummary}>Review order <ArrowRight /></Button>
            </div>
          </Card>
        </div>
      )}

      {step === 3 && (
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Card className="p-5">
            <h3 className="mb-3 text-sm font-semibold">Order items</h3>
            <div className="space-y-2">
              {cart.map((l) => (
                <div key={l.key} className="flex items-center gap-2.5 border-b py-2.5 last:border-0">
                  <CardThumb url={l.imageUrl} alt={l.name} className="h-12 w-9" />
                  <div className="min-w-0 flex-1"><b className="block truncate text-[13px]">{l.name}</b><span className="text-[11px] text-muted-foreground">{l.sub}</span></div>
                  <div className="flex items-center overflow-hidden rounded-md border">
                    <button className="grid size-7 place-items-center hover:bg-muted disabled:opacity-40" disabled={l.itemType === 'SLAB'} onClick={() => setQty(l.key, -1)}><Minus className="size-3.5" /></button>
                    <span className="w-7 text-center text-[13px] font-semibold tabular-nums">{l.quantity}</span>
                    <button className="grid size-7 place-items-center hover:bg-muted disabled:opacity-40" disabled={l.itemType === 'SLAB' || l.quantity >= l.max} onClick={() => setQty(l.key, 1)}><Plus className="size-3.5" /></button>
                  </div>
                  <Input type="number" value={l.unitPrice} onChange={(e) => setPrice(l.key, Number(e.target.value))} className="h-8 w-24 text-right" />
                  <Button variant="ghost" size="icon" onClick={() => removeLine(l.key)} aria-label="Remove"><Trash2 /></Button>
                </div>
              ))}
            </div>
            <Button variant="ghost" size="sm" className="mt-3" onClick={() => setStep(2)}><Plus /> Add more products</Button>
          </Card>
          <Card className="p-5">
            <h3 className="mb-3 text-sm font-semibold">Summary</h3>
            <div className="mb-3 text-[13px] text-muted-foreground">{existing?.name ?? newCustomer.name} · {COURIERS.find((c) => c.value === courier)?.label}</div>
            <Row label="Subtotal" value={peso(subtotal)} />
            <div className="flex items-center justify-between py-1.5 text-sm"><span>Discount</span>
              <Input type="number" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} className="h-7 w-24 text-right" /></div>
            <Row label="Shipping fee" value={peso(Number(shippingFee || 0))} />
            <Row label="Est. profit" value={peso(profit)} valueClass="text-success" />
            <div className="mt-2 flex items-center justify-between border-t pt-3 text-base font-bold"><span>Grand total</span><span className="tabular-nums">{pesoF(grandTotal)}</span></div>
            <div className="mt-4 flex gap-2">
              <Button variant="ghost" onClick={() => setStep(2)}><ArrowLeft /> Back</Button>
              <Button className="flex-1" onClick={() => setStep(4)}>Proceed to payment <ArrowRight /></Button>
            </div>
          </Card>
        </div>
      )}

      {step === 4 && (
        <Card className="max-w-md p-5">
          <h3 className="mb-3 text-sm font-semibold">Payment & confirmation</h3>
          <div className="mb-4 flex items-center justify-between border-b pb-3 text-base font-bold"><span>Grand total</span><span className="tabular-nums">{pesoF(grandTotal)}</span></div>
          <div className="mb-3"><Label>Payment status</Label>
            <Select value={paymentStatus} onChange={(e) => { const v = e.target.value as any; setPaymentStatus(v); setAmountPaid(v === 'PAID' ? grandTotal : v === 'UNPAID' ? 0 : amountPaid); }} className="mt-1 w-full">
              <option value="PAID">Paid</option><option value="PARTIAL">Partially Paid</option><option value="UNPAID">Unpaid</option>
            </Select></div>
          {paymentStatus === 'PARTIAL' && (
            <div className="mb-3"><Label>Amount paid (₱)</Label><Input type="number" value={amountPaid} onChange={(e) => setAmountPaid(Number(e.target.value))} className="mt-1" /></div>
          )}
          <div className="mb-4"><Label>Payment method</Label><Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="mt-1 w-full">{PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}</Select></div>
          <div className="mb-4 rounded-lg border bg-muted/40 p-3 text-[12.5px] text-muted-foreground">
            Completing this deducts inventory, marks slabs sold, records {peso(profit)} profit, logs the sale and queues a shipment.
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setStep(3)}><ArrowLeft /> Back</Button>
            <Button className="flex-1" onClick={submit} disabled={complete.isPending}>{complete.isPending ? <Spinner /> : <><CheckCircle2 /> Complete sale</>}</Button>
          </div>
        </Card>
      )}

      {step === 5 && result && (
        <Card className="mx-auto max-w-md p-8 text-center">
          <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-success/10"><CheckCircle2 className="size-8 text-success" /></div>
          <h2 className="text-lg font-bold">Sale completed</h2>
          <p className="mt-1 text-sm text-muted-foreground">Transaction <b>{result.reference}</b></p>
          <div className="my-5 grid grid-cols-2 gap-3 text-left">
            <div className="rounded-lg border p-3"><div className="text-[11px] text-muted-foreground">Grand total</div><div className="text-lg font-bold tabular-nums">{peso(result.grandTotal)}</div></div>
            <div className="rounded-lg border p-3"><div className="text-[11px] text-muted-foreground">Profit</div><div className="text-lg font-bold tabular-nums text-success">{peso(result.totalProfit)}</div></div>
          </div>
          <div className="flex justify-center gap-2">
            <Button variant="outline" onClick={reset}>New sale</Button>
            <Button onClick={() => navigate('/sales-history')}>View sales</Button>
          </div>
        </Card>
      )}
    </>
  );
}

function ProductRow({ img, name, sub, price, badge, onAdd }: { img?: string; name: string; sub: string; price: string | number; badge?: string; onAdd: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border p-2">
      <CardThumb url={img} alt={name} className="h-12 w-9" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5"><b className="truncate text-[13px]">{name}</b>{badge && <Badge variant="info">{badge}</Badge>}</div>
        <span className="text-[11px] text-muted-foreground">{sub}</span>
      </div>
      <b className="tabular-nums text-[13px]">{peso(price)}</b>
      <Button size="sm" onClick={onAdd}>Add</Button>
    </div>
  );
}
function Row({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return <div className="flex justify-between py-1.5 text-sm"><span>{label}</span><b className={`tabular-nums ${valueClass ?? ''}`}>{value}</b></div>;
}
