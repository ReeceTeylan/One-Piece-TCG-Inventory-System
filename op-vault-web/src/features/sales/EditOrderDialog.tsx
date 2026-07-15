import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Search, Trash2, Minus, Plus, Save } from 'lucide-react';
import { toast } from 'sonner';
import { CardThumb } from '@/components/common/CardImage';
import { peso, pesoF } from '@/lib/utils';
import { useDebounce } from '@/hooks/use-debounce';
import { useProductSearch, useSaleMutations } from '@/features/sales/use-sales';
import { CartLine, cartSubtotal } from '@/features/sales/cart';

interface EditOrderDialogProps {
  sale: any; // The existing sale object containing its current items
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditOrderDialog({ sale, open, onOpenChange, onSuccess }: EditOrderDialogProps) {
  const { editItems } = useSaleMutations();
  const [prodSearch, setProdSearch] = useState('');
  const prodDebounced = useDebounce(prodSearch);
  const { raw, slabs } = useProductSearch(prodDebounced);
  
  const [cart, setCart] = useState<CartLine[]>([]);

  // Pre-load existing sale items into the cart state when dialog opens
  useEffect(() => {
    if (open && sale) {
      const initialCart: CartLine[] = sale.items.map((item: any) => {
        const isSlab = item.itemType === 'SLAB';
        return {
          key: isSlab ? `slab-${item.slabId}` : `raw-${item.rawCardId}`,
          itemType: item.itemType,
          rawCardId: item.rawCardId,
          slabId: item.slabId,
          name: isSlab ? (item.slab?.name || 'Deleted Slab') : (item.rawCard?.name || 'Deleted Card'),
          sub: isSlab 
            ? `${item.slab?.gradingCompany || 'Unknown'} ${Number(item.slab?.grade || 0)}` 
            : (item.rawCard?.cardNumber || 'N/A'),
          imageUrl: isSlab ? item.slab?.images?.[0]?.url : item.rawCard?.images?.[0]?.url,
          unitPrice: Number(item.unitPrice),
          unitCost: Number(item.unitCost || 0),
          quantity: item.quantity,
          // CRITICAL: True max = what's left in inventory + what's already held by this sale line
          max: isSlab ? 1 : ((item.rawCard?.quantity || 0) + item.quantity),
        };
      });
      setCart(initialCart);
    } else {
      setCart([]);
      setProdSearch('');
    }
  }, [open, sale]);

  const subtotal = useMemo(() => cartSubtotal(cart), [cart]);
  // Assuming discount and shippingFee are retained from the original order
  const grandTotal = subtotal - Number(sale?.discount || 0) + Number(sale?.shippingFee || 0);

  // --- Reused Wizard Cart Mechanics ---
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

  const removeLine = (key: string) => setCart((prev) => prev.filter((l) => l.key !== key));
  // ----------------------------------

  const handleSave = async () => {
    if (!cart.length) return toast.error('Order must have at least one item');
    
    const payload = {
      items: cart.map((l) => ({
        itemType: l.itemType,
        rawCardId: l.rawCardId,
        slabId: l.slabId,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
      }))
    };

    try {
      await editItems.mutateAsync({ saleId: sale.id, data: payload });
      toast.success('Order items updated successfully');
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to update order items');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Edit Order Items — {sale?.reference}</DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr] mt-2">
          {/* Left: Product Search */}
          <Card className="p-5 flex flex-col h-[500px]">
            <div className="relative mb-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={prodSearch} onChange={(e) => setProdSearch(e.target.value)} placeholder="Search raw cards or slabs…" className="pl-9" />
            </div>
            
            <div className="flex-1 space-y-1.5 overflow-y-auto pr-2">
              {raw.data?.data.map((c: any) => (
                <ProductRow key={`search-raw-${c.id}`} img={c.images?.[0]?.url} name={c.name} sub={`${c.cardNumber} · ${c.quantity} in stock`} price={c.postedPrice} onAdd={() => addRaw(c)} />
              ))}
              {slabs.data?.data.map((s: any) => (
                <ProductRow key={`search-slab-${s.id}`} img={s.images?.[0]?.url} name={s.name} sub={`${s.gradingCompany} ${Number(s.grade)} · cert ${s.slabNumber}`} price={s.sellPrice} badge="SLAB" onAdd={() => addSlab(s)} />
              ))}
              {(raw.isLoading || slabs.isLoading) && <div className="flex justify-center py-6"><Spinner /></div>}
              {!raw.isLoading && !slabs.isLoading && !raw.data?.data.length && !slabs.data?.data.length && (
                <p className="py-8 text-center text-sm text-muted-foreground">No available items match.</p>
              )}
            </div>
          </Card>

          {/* Right: Cart Editor */}
          <Card className="p-5 flex flex-col h-[500px]">
            <h3 className="mb-3 text-sm font-semibold flex justify-between">
              Current Items <span className="text-muted-foreground">{cart.length} item(s)</span>
            </h3>
            
            <div className="flex-1 space-y-2 overflow-y-auto pr-2">
              {cart.length ? cart.map((l) => (
                <div key={`cart-${l.key}`} className="flex items-center gap-2.5 border-b py-2.5 last:border-0">
                  <CardThumb url={l.imageUrl} alt={l.name} className="h-12 w-9" />
                  <div className="min-w-0 flex-1">
                    <b className="block truncate text-[13px]">{l.name}</b>
                    <span className="text-[11px] text-muted-foreground">{l.sub}</span>
                  </div>
                  <div className="flex items-center overflow-hidden rounded-md border bg-background">
                    <button className="grid size-7 place-items-center hover:bg-muted disabled:opacity-40" disabled={l.itemType === 'SLAB'} onClick={() => setQty(l.key, -1)}><Minus className="size-3.5" /></button>
                    <span className="w-7 text-center text-[13px] font-semibold tabular-nums">{l.quantity}</span>
                    <button className="grid size-7 place-items-center hover:bg-muted disabled:opacity-40" disabled={l.itemType === 'SLAB' || l.quantity >= l.max} onClick={() => setQty(l.key, 1)}><Plus className="size-3.5" /></button>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeLine(l.key)} aria-label="Remove"><Trash2 className="size-4" /></Button>
                </div>
              )) : <p className="py-10 text-center text-sm text-muted-foreground">Order has no items</p>}
            </div>

            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center justify-between mb-4 text-base font-bold">
                <span>Updated Grand Total</span>
                <span className="tabular-nums">{pesoF(grandTotal)}</span>
              </div>
              <Button className="w-full" onClick={handleSave} disabled={editItems.isPending}>
                {editItems.isPending ? <Spinner /> : <><Save className="mr-2 size-4" /> Save Changes</>}
              </Button>
            </div>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Reusing ProductRow from the Wizard
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