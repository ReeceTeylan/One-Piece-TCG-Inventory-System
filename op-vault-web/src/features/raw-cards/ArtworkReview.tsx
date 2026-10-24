import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ExternalLink, Images, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { marketPricesService, type MarketSource } from '@/services';
import { apiError } from '@/lib/api';

export function ArtworkReview({ cardNumber, notes, rarity, photo, selected, onSelect }: {
  cardNumber: string; notes: string; rarity: string; photo: File | null;
  selected: string | null; onSelect: (key: string | null, source: MarketSource | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [shop, setShop] = useState<MarketSource>('YUYUTEI');
  const [checking, setChecking] = useState(false);
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [scores, setScores] = useState<Record<string, number | null>>({});
  const english = /\b(?:english|eng)\b/i.test(notes);
  const source = english ? 'TCGPLAYER' : shop;
  const num = cardNumber.trim().toUpperCase();
  const valid = /^[A-Z0-9]+-\d{2,3}$/.test(num);
  useEffect(() => { onSelect(null, null); setScores({}); }, [num, rarity, source]);
  const candidates = useQuery({
    queryKey: ['artwork-review', num, source, refreshIndex],
    queryFn: () => marketPricesService.listings(num, source),
    enabled: open && valid, retry: false, staleTime: 5 * 60_000,
  });
  async function compare() {
    if (!photo) return toast.error('Choose your card photo first');
    setChecking(true);
    try {
      const result = await marketPricesService.compareArtwork(photo, num, source);
      setScores(Object.fromEntries(result.results.map(x => [x.listingKey, x.similarity])));
      toast.info(result.checked ? 'Photo compared. Please confirm the printing visually.' : 'No reference images were available to compare.');
    } catch (e) { toast.error(apiError(e).message); }
    finally { setChecking(false); }
  }
  return <section className="space-y-2 rounded-lg border p-3 sm:col-span-2">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h3 className="text-sm font-semibold">Verify artwork before listing</h3><p className="text-xs text-muted-foreground">Compare the exact art, print and language before saving.</p></div>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(v => !v)}><Images className="size-4" /> {open ? 'Hide artwork' : 'Cross-check'}</Button>
    </div>
    {open && <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Select className="max-w-[170px]" value={source} disabled={english} onChange={e => setShop(e.target.value as MarketSource)}>
          <option value="YUYUTEI">Yuyu-tei</option><option value="CARDRUSH">Cardrush</option><option value="TCGPLAYER">TCGplayer</option>
        </Select>
        <Button type="button" size="sm" variant="outline" disabled={!photo || !valid || checking || candidates.isFetching} onClick={compare}>
          {checking ? <Loader2 className="size-4 animate-spin" /> : <Images className="size-4" />} Compare photo
        </Button>
      </div>
      {valid && <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setRefreshIndex(v => v + 1); setScores({}); }} disabled={candidates.isFetching}>Retry artwork lookup</Button>}
      {!valid && <p className="text-xs text-muted-foreground">Enter a complete card number first (e.g. OP01-120).</p>}
      {candidates.isFetching && <p className="text-xs text-muted-foreground">Looking up artwork…</p>}
      {candidates.isError && <p className="text-xs text-destructive">Reference artwork is unavailable. Please verify the card manually.</p>}
      {candidates.data?.length === 0 && <p className="text-xs text-muted-foreground">No listings returned for this card number. The catalog may be missing this printing; try another source or Retry.</p>}
      <div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
        {candidates.data?.map(item => <div key={item.listingKey} className={`min-w-0 rounded-md border p-2 ${selected === item.listingKey ? 'border-primary ring-1 ring-primary' : ''}`}>
          <div className="flex h-28 items-center justify-center overflow-hidden rounded bg-muted/30">
            {item.imageUrl ? <img src={item.imageUrl} loading="lazy" referrerPolicy="no-referrer" alt={item.name} className="max-h-full max-w-full object-contain" /> : <span className="text-center text-xs text-muted-foreground">No thumbnail</span>}
          </div>
          <p className="mt-1 truncate text-xs font-semibold" title={item.name}>{item.name}</p>
          <p className="truncate text-[11px] text-muted-foreground">{item.rarity ?? '—'} · {item.price} {item.currency}</p>
          {scores[item.listingKey] !== undefined && <p className="text-[11px] text-warning">Image similarity: {scores[item.listingKey] === null ? 'Unavailable' : `${scores[item.listingKey]}% (estimate)`}</p>}
          <div className="mt-1 flex items-center justify-between gap-1">
            <Button type="button" size="sm" className="h-7 text-xs" variant={selected === item.listingKey ? 'default' : 'outline'} onClick={() => onSelect(selected === item.listingKey ? null : item.listingKey, selected === item.listingKey ? null : source)}>
              {selected === item.listingKey ? <><Check className="size-3" /> Chosen</> : 'Choose'}
            </Button>
            <a href={item.url} target="_blank" rel="noreferrer" aria-label="Open shop listing" className="p-1 text-muted-foreground"><ExternalLink className="size-4" /></a>
          </div>
        </div>)}
      </div>
      <p className="text-xs text-muted-foreground">A photo score is not proof: glare, crops, special artworks and reprints can look alike. The choice links pricing to the selected listing; the vendor image is not copied into OP Vault.</p>
    </div>}
  </section>;
}
