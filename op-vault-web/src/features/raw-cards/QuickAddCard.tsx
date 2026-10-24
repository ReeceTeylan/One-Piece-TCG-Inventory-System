import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Search, CheckCircle2, ExternalLink, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { apiError } from '@/lib/api';
import { marketPricesService, type MarketSource } from '@/services';
import { peso } from '@/lib/utils';
import { useDebounce } from '@/hooks/use-debounce';

export function QuickAddCard({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const [number, setNumber] = useState('');
  const [source, setSource] = useState<MarketSource>('YUYUTEI');
  const [key, setKey] = useState('');
  const [qty, setQty] = useState('1');
  const [notes, setNotes] = useState('');
  const [buy, setBuy] = useState('');
  const [sell, setSell] = useState('');
  const [customBuy, setCustomBuy] = useState(false);
  const [customSell, setCustomSell] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const debounced = useDebounce(number.trim().toUpperCase(), 350);
  const valid = /^[A-Z0-9]+-\d{2,3}$/.test(debounced);
  const listings = useQuery({
    queryKey: ['quick-add-list', debounced, source],
    queryFn: () => marketPricesService.listings(debounced, source),
    enabled: open && valid, staleTime: 60_000, retry: false,
  });
  const preview = useQuery({
    queryKey: ['quick-add-preview', debounced, source, key, notes],
    queryFn: () => marketPricesService.quickPreview({ cardNumber: debounced, source, listingKey: key, notes }),
    enabled: open && valid && !!key, staleTime: 0, retry: false,
  });
  useEffect(() => { setKey(''); setDone(null); }, [debounced, source]);
  useEffect(() => {
    if (!preview.data) return;
    if (!customBuy) setBuy(preview.data.buyCost.toFixed(2));
    if (!customSell) setSell(preview.data.postedPrice === null ? '' : String(preview.data.postedPrice));
  }, [preview.data, customBuy, customSell]);
  useEffect(() => {
    if (!open) { setKey(''); setQty('1'); setNotes(''); setBuy(''); setSell(''); setCustomBuy(false); setCustomSell(false); setAuthorized(false); setDone(null); }
  }, [open]);

  const record = preview.data;
  const existing = record?.existing;
  const canSave = !!record && Number.isInteger(Number(qty)) && Number(qty) > 0 &&
    buy.trim() !== '' && sell.trim() !== '' && Number.isFinite(Number(buy)) &&
    Number.isFinite(Number(sell)) && Number(buy) >= 0 && Number(sell) >= 0 && !saving;
  const action = existing ? existing.quantity > 0 ? 'Add stock' : 'Reactivate listing' : 'Create listing';

  async function save() {
    if (!canSave || !record) return;
    setSaving(true);
    try {
      const result = await marketPricesService.quickAdd({
        cardNumber: debounced, source, listingKey: key, quantity: Number(qty),
        notes, buyCost: Number(buy), postedPrice: Number(sell),
      });
      if (authorized && (!result.hasImage || result.action === 'created')) {
        try {
          await marketPricesService.importArtwork({ itemId: result.card.id, listingKey: key, source, authorized: true });
        } catch { toast.info('Stock saved; source image unavailable. Add your own image later.'); }
      }
      setDone(result.action === 'created' ? 'New listing created' : result.action === 'reactivated' ? 'Listing reactivated' : 'Quantity added to existing listing');
      for (const k of ['raw-cards','card-market','market-prices','dashboard']) qc.invalidateQueries({ queryKey: [k] });
      toast.success('Stock saved');
      setKey(''); setNumber(''); setQty('1'); setNotes(''); setBuy(''); setSell(''); setCustomBuy(false); setCustomSell(false); setAuthorized(false);
    } catch (error) { toast.error(apiError(error).message); }
    finally { setSaving(false); }
  }

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="flex h-[calc(100dvh-1.5rem)] max-h-[900px] w-[calc(100vw-1.5rem)] max-w-4xl flex-col overflow-hidden p-0 max-sm:top-1/2 max-sm:max-h-[calc(100dvh-1rem)] max-sm:w-[calc(100vw-1rem)] max-sm:-translate-y-1/2 max-sm:overflow-hidden max-sm:p-0">
      <DialogHeader className="mb-0 shrink-0 border-b px-4 py-3 pr-12 sm:px-6">
        <DialogTitle>Quick Add · New cards</DialogTitle>
        <p className="text-xs text-muted-foreground">Enter a card number, select the exact art, then confirm quantity and prices.</p>
      </DialogHeader>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-3 sm:p-5">
        {done && <div className="rounded-lg border border-success/30 p-3 text-sm text-success"><CheckCircle2 className="mr-2 inline size-4" />{done}. Ready for the next card.</div>}
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px]">
          <div><Label>Card number</Label><div className="relative mt-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input autoFocus value={number} onChange={e => setNumber(e.target.value.toUpperCase())} placeholder="OP01-120" className="pl-9" /></div></div>
          <div><Label>Price / card catalog</Label><Select value={source} className="mt-1 w-full" onChange={e => setSource(e.target.value as MarketSource)}><option value="YUYUTEI">Yuyu-tei</option><option value="CARDRUSH">Cardrush</option><option value="TCGPLAYER">TCGplayer</option></Select></div>
        </div>
        {!valid && <p className="text-xs text-muted-foreground">Enter a full card number to load variants.</p>}
        {listings.isFetching && <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-3 animate-spin" /> Looking up printings…</p>}
        {listings.isError && <p className="text-xs text-destructive">Source lookup unavailable: {apiError(listings.error).message}</p>}
        {listings.data?.length === 0 && <p className="text-xs text-muted-foreground">No matching listings found. Try another source.</p>}
        {!!listings.data?.length && <section className="space-y-2">
          <div className="text-xs font-semibold text-muted-foreground">{listings.data.length} variants · select the exact artwork</div>
          <div className="grid max-h-[260px] grid-cols-3 gap-1.5 overflow-y-auto overscroll-contain sm:grid-cols-5 sm:gap-2">
            {listings.data.map(item => <button type="button" key={item.listingKey} onClick={() => { setKey(item.listingKey); setCustomBuy(false); setCustomSell(false); setAuthorized(false); }} className={`min-w-0 rounded-lg border p-1.5 text-left ${key === item.listingKey ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'bg-card hover:bg-muted'}`} aria-pressed={key === item.listingKey}>
              <div className="flex h-24 items-center justify-center overflow-hidden rounded bg-muted/40 sm:h-32">{item.imageUrl ? <img src={item.imageUrl} alt={item.name} referrerPolicy="no-referrer" loading="lazy" className="h-full w-full object-contain" /> : <span className="text-center text-[10px]">No image</span>}</div>
              <p className="mt-1 truncate text-[11px] font-semibold" title={item.name}>{item.name}</p><p className="truncate text-[10px] text-muted-foreground">{item.rarity ?? '—'} · {item.price} {item.currency}</p>
            </button>)}
          </div>
        </section>}
        {preview.isFetching && <p className="flex items-center gap-2 text-xs"><Loader2 className="size-3 animate-spin" /> Preparing card information…</p>}
        {preview.isError && <p className="text-xs text-destructive">Could not prepare selected card: {apiError(preview.error).message}</p>}
        {record && <section className="space-y-3 rounded-lg border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-semibold">{record.metadata.name}</span><span className="rounded bg-muted px-2 py-1 text-xs">{existing ? `Existing · ${existing.quantity} in stock` : 'New listing'}</span></div>
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4"><div><span className="text-muted-foreground">Set</span><p className="font-semibold">{record.metadata.setName}</p></div><div><span className="text-muted-foreground">Rarity</span><p className="font-semibold">{record.metadata.rarity}</p></div><div><span className="text-muted-foreground">Character</span><p className="font-semibold">{record.metadata.character}</p></div><div><span className="text-muted-foreground">Color</span><p className="font-semibold">{record.metadata.color ?? 'Not provided'}</p></div></div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div><Label>Quantity to add</Label><Input className="mt-1" type="number" min="1" step="1" value={qty} onChange={e => setQty(e.target.value)} /></div>
            <div><Label>Buying cost (₱)</Label><Input className="mt-1" type="number" min="0" step=".01" value={buy} onChange={e => {setBuy(e.target.value);setCustomBuy(true);}} /></div>
            <div><Label>Selling price (₱)</Label><Input className="mt-1" type="number" min="0" step="1" value={sell} onChange={e => {setSell(e.target.value);setCustomSell(true);}} /></div>
            <div className="flex flex-col justify-end gap-1 text-xs text-muted-foreground"><span>Buy conversion: ×{record.purchaseRate}</span><span>Sell conversion: {record.rate ? '×'+record.rate : 'Not configured'}</span></div>
          </div>
          <p className="text-[11px] text-muted-foreground">{existing?.quantity ? `Existing selling price ${peso(existing.postedPrice)} will stay unchanged when restocking. Buying cost is weighted with the incoming batch.` : 'Buying cost is set at this entry and remains editable. Selling price follows your Settings rate and rounding.'}</p>
          <div><Label>Notes (optional)</Label><Textarea rows={2} className="mt-1" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Condition, language, other details…" /></div>
          <label className="flex items-start gap-2 text-xs text-muted-foreground"><input type="checkbox" className="mt-0.5" checked={authorized} onChange={e=>setAuthorized(e.target.checked)}/> Use the selected source image if available. I confirm I have rights to republish that image. Otherwise I'll add a photo later.</label>
          <a href={record.listing.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary"><ExternalLink className="size-3" /> Open reference listing</a>
        </section>}
      </div>
      <DialogFooter className="mt-0 shrink-0 items-center border-t bg-card p-3 max-sm:static sm:p-4">
        <Button variant="ghost" type="button" onClick={()=>onOpenChange(false)}>Close</Button>
        <Button type="button" disabled={!canSave} onClick={save}>{saving ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}{action}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
