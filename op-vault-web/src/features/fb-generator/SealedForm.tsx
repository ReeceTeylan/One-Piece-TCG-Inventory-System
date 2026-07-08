import { useRef, useState } from 'react';
import { Plus, Upload, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { CardThumb } from '@/components/common/CardImage';
import { toast } from 'sonner';
import type { FbCard } from './types';

const PRESETS = ['Starter Deck', 'Booster Box', 'Double Pack', 'Gift Collection', 'Premium Collection', 'Anniversary Set', 'Booster Pack'];

// Sealed products have no backend inventory endpoint, so they're entered manually here.
// The optional image is kept as a local object URL — used for preview/export only.
export function SealedForm({ onAdd }: { onAdd: (card: FbCard) => void }) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [note, setNote] = useState('');
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const fileRef = useRef<HTMLInputElement>(null);

  const pickImage = () => fileRef.current?.click();
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      if (!f.type.startsWith('image/')) { toast.error('Choose an image file'); return; }
      setImageUrl(URL.createObjectURL(f));
    }
    e.target.value = '';
  };

  const submit = () => {
    if (!name.trim()) { toast.error('Product name is required'); return; }
    onAdd({
      key: `sealed-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      id: `sealed-${Date.now()}`,
      itemType: 'SEALED',
      name: name.trim(),
      cardNumber: '',
      price: Number(price) || 0,
      quantity: Number(quantity) || 1,
      note: note.trim() || undefined,
      imageUrl,
      badge: 'none',
    });
    setName(''); setPrice(''); setQuantity('1'); setNote(''); setImageUrl(undefined);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex flex-wrap gap-1">
        {PRESETS.map((p) => (
          <button key={p} onClick={() => setName(p)} className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted">{p}</button>
        ))}
      </div>
      <div className="space-y-2">
        <div><Label>Product name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Booster Box" className="mt-1" /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>Price (₱)</Label><Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="mt-1" /></div>
          <div><Label>Quantity</Label><Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="mt-1" /></div>
        </div>
        <div><Label>Notes</Label><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. sealed, English" className="mt-1" /></div>
        <div>
          <Label>Image</Label>
          <div className="mt-1 flex items-center gap-2">
            {imageUrl
              ? <div className="relative"><CardThumb url={imageUrl} alt={name} className="h-14 w-10" />
                  <button onClick={() => setImageUrl(undefined)} className="absolute -right-1.5 -top-1.5 grid size-4 place-items-center rounded-full bg-destructive text-white" aria-label="Remove image"><X className="size-2.5" /></button></div>
              : <Button variant="outline" size="sm" onClick={pickImage}><Upload /> Add image</Button>}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
          </div>
        </div>
        <Button className="w-full" onClick={submit}><Plus /> Add to layout</Button>
      </div>
    </div>
  );
}
