import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ImageUploader } from '@/components/common/ImageUploader';
import { useRawCardMutations, RARITIES, COLORS } from './use-raw-cards';
import { useImageUpload } from '@/features/images/use-image-upload';
import { apiError } from '@/lib/api';
import type { RawCard } from '@/types';

const schema = z.object({
  name: z.string().min(1, 'Required'),
  cardNumber: z.string().min(1, 'Required'),
  setName: z.string().min(1, 'Required'),
  character: z.string().optional(),
  color: z.string().optional(),
  rarity: z.string().min(1),
  quantity: z.coerce.number().int().min(0),
  buyCost: z.coerce.number().min(0),
  postedPrice: z.coerce.number().min(0),
  notes: z.string().optional(),
});
type Form = z.infer<typeof schema>;

export function RawCardForm({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (o: boolean) => void; editing?: RawCard | null }) {
  const { create, update, addQuantity } = useRawCardMutations();
  const { upload, removeImage, uploading, progress } = useImageUpload();
  const [dup, setDup] = useState<{ cardId: string; currentQuantity: number; quantity: number } | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [removeExisting, setRemoveExisting] = useState(false);
  const existingImage = editing?.images?.[0] ?? null;

  const { register, handleSubmit, reset, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema), defaultValues: { rarity: 'SR', color: 'Red', quantity: 1 },
  });

  useEffect(() => {
    if (editing) {
      reset({
        name: editing.name, cardNumber: editing.cardNumber, setName: editing.setName,
        character: editing.character ?? '', color: editing.color ?? 'Red', rarity: editing.rarity,
        quantity: editing.quantity, buyCost: Number(editing.buyCost), postedPrice: Number(editing.postedPrice),
        notes: editing.notes ?? '',
      });
    } else {
      reset({ rarity: 'SR', color: 'Red', quantity: 1, name: '', cardNumber: '', setName: '', buyCost: 0, postedPrice: 0 });
    }
    setFile(null); setRemoveExisting(false);
  }, [editing, open, reset]);

  const finishClose = () => { reset(); setFile(null); setRemoveExisting(false); onOpenChange(false); };

  const handleImage = async (cardId: string) => {
    // remove-then-replace semantics for a single primary image
    if ((file || removeExisting) && existingImage) {
      try { await removeImage(existingImage.id); } catch { /* non-fatal */ }
    }
    if (file) await upload(file, 'RAW', cardId);
  };

  const submit = async (data: Form) => {
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, dto: data });
        await handleImage(editing.id);
        toast.success('Raw card updated');
        finishClose();
        return;
      }
      const card = await create.mutateAsync(data);
      if (file) {
        try { await upload(file, 'RAW', card.id); }
        catch { toast.error('Card saved, but image upload failed. You can re-upload from Edit.'); }
      }
      toast.success('Raw card added');
      finishClose();
    } catch (e) {
      const err = apiError(e);
      if (err.code === 'CARD_EXISTS') {
        setDup({ cardId: err.body.cardId, currentQuantity: err.body.currentQuantity, quantity: data.quantity });
      } else {
        toast.error(err.message);
      }
    }
  };

  const confirmAddQty = async () => {
    if (!dup) return;
    try {
      await addQuantity.mutateAsync({ id: dup.cardId, quantity: dup.quantity });
      if (file) { try { await upload(file, 'RAW', dup.cardId); } catch { /* non-fatal */ } }
      toast.success(`Added ${dup.quantity} to existing card`);
      setDup(null); finishClose();
    } catch (e) { toast.error(apiError(e).message); }
  };

  const busy = create.isPending || update.isPending || uploading;
  const field = (label: string, name: keyof Form, type = 'text') => (
    <div><Label>{label}</Label><Input type={type} {...register(name)} className="mt-1" />{errors[name] && <p className="mt-1 text-xs text-destructive">{errors[name]?.message as string}</p>}</div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit raw card' : 'Add raw card'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(submit)} className="grid grid-cols-2 gap-3">
            {field('Card name', 'name')}
            {field('Card number', 'cardNumber')}
            {field('Set', 'setName')}
            {field('Character', 'character')}
            <div><Label>Color</Label><Select {...register('color')} className="mt-1 w-full">{COLORS.map((c) => <option key={c}>{c}</option>)}</Select></div>
            <div><Label>Rarity</Label><Select {...register('rarity')} className="mt-1 w-full">{RARITIES.map((r) => <option key={r}>{r}</option>)}</Select></div>
            {field('Buying cost (₱)', 'buyCost', 'number')}
            {field('Posted price (₱)', 'postedPrice', 'number')}
            {field('Quantity', 'quantity', 'number')}
            <div className="col-span-2"><Label>Notes</Label><Textarea {...register('notes')} className="mt-1" /></div>
            <div className="col-span-2">
              <Label>Card image</Label>
              <ImageUploader
                className="mt-1"
                existingUrl={removeExisting ? null : existingImage?.url}
                onFileChange={setFile}
                onRemoveExisting={() => setRemoveExisting(true)}
                uploading={uploading}
                progress={progress}
                disabled={busy}
              />
            </div>
            <DialogFooter className="col-span-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={busy}>{busy ? (uploading ? 'Uploading…' : 'Saving…') : editing ? 'Save changes' : 'Add card'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!dup} onOpenChange={(o) => !o && setDup(null)}
        title="This card already exists"
        description={dup ? `Already in inventory with ${dup.currentQuantity} in stock. Add ${dup.quantity} to the quantity instead of creating a duplicate?` : ''}
        confirmLabel={dup ? `Add ${dup.quantity} to quantity` : 'Confirm'}
        loading={addQuantity.isPending || uploading}
        onConfirm={confirmAddQty}
      />
    </>
  );
}
