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
import { ImageUploader } from '@/components/common/ImageUploader';
import { useImageUpload } from '@/features/images/use-image-upload';
import { apiError } from '@/lib/api';
import { useSlabMutations, GRADING_COMPANIES, GRADES } from './use-slabs';
import type { SlabCard } from '@/types';

const schema = z.object({
  kind: z.enum(['SLAB', 'SEALED']),
  name: z.string().min(1, 'Required'),
  cardNumber: z.string().optional(),
  setName: z.string().optional(),
  character: z.string().optional(),
  rarity: z.string().optional(),
  gradingCompany: z.string().optional(),
  slabNumber: z.string().optional(),
  grade: z.coerce.number().min(1).max(10).optional(),
  quantity: z.coerce.number().int().min(0).optional(),
  buyCost: z.coerce.number().min(0),
  sellPrice: z.coerce.number().min(0),
  notes: z.string().optional(),
}).superRefine((v, ctx) => {
  // Grading fields are required for slabs only.
  if (v.kind !== 'SLAB') return;
  if (!v.gradingCompany) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['gradingCompany'], message: 'Required' });
  if (!v.slabNumber) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['slabNumber'], message: 'Required' });
  if (v.grade === undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['grade'], message: 'Required' });
});
type Form = z.infer<typeof schema>;

export function SlabForm({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (o: boolean) => void; editing?: SlabCard | null }) {
  const { create, update } = useSlabMutations();
  const { upload, removeImage, uploading, progress } = useImageUpload();
  const [file, setFile] = useState<File | null>(null);
  const [removeExisting, setRemoveExisting] = useState(false);
  const existingImage = editing?.images?.[0] ?? null;
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { kind: 'SLAB', gradingCompany: 'PSA', grade: 10, quantity: 1 },
  });
  const isSealed = watch('kind') === 'SEALED';

  useEffect(() => {
    if (editing) {
      reset({
        name: editing.name, cardNumber: editing.cardNumber ?? '', setName: editing.setName ?? '',
        character: editing.character ?? '', rarity: editing.rarity ?? '',
        kind: editing.kind,
        gradingCompany: editing.gradingCompany ?? 'PSA',
        slabNumber: editing.slabNumber ?? '',
        grade: editing.grade ? Number(editing.grade) : 10,
        quantity: editing.quantity,
        buyCost: Number(editing.buyCost),
        sellPrice: Number(editing.sellPrice), notes: editing.notes ?? '',
      });
    } else {
      reset({ kind: 'SLAB', gradingCompany: 'PSA', grade: 10, quantity: 1, name: '', slabNumber: '', buyCost: 0, sellPrice: 0 });
    }
    setFile(null); setRemoveExisting(false);
  }, [editing, open, reset]);

  const applyImage = async (slabId: string) => {
    if ((file || removeExisting) && existingImage) {
      try { await removeImage(existingImage.id); } catch { /* non-fatal */ }
    }
    if (file) await upload(file, 'SLAB', slabId);
  };

  const submit = async (data: Form) => {
    const { kind, gradingCompany, slabNumber, grade, quantity, ...common } = data;
    // Send only the fields that apply to this kind.
    const payload = kind === 'SEALED'
      ? { ...common, kind, quantity: quantity ?? 1 }
      : { ...common, kind, gradingCompany, slabNumber, grade };
    try {
      if (editing) {
        // Cert number and kind are both immutable after creation.
        const { slabNumber: _cert, kind: _kind, ...rest } = payload as any;
        await update.mutateAsync({ id: editing.id, dto: rest });
        await applyImage(editing.id);
        toast.success(editing.kind === 'SEALED' ? 'Sealed product updated' : 'Slab updated');
      } else {
        const slab = await create.mutateAsync(payload);
        if (file) {
          try { await upload(file, 'SLAB', slab.id); }
          catch { toast.error('Slab saved, but image upload failed. You can re-upload from Edit.'); }
        }
        toast.success(kind === 'SEALED' ? 'Sealed product added' : 'Slab added');
      }
      reset(); setFile(null); setRemoveExisting(false); onOpenChange(false);
    } catch (e) {
      const err = apiError(e);
      toast.error(err.code === 'SLAB_EXISTS' ? 'That certification number already exists' : err.message);
    }
  };

  const pending = create.isPending || update.isPending || uploading;
  const field = (label: string, name: keyof Form, type = 'text', props: any = {}) => (
    <div><Label>{label}</Label><Input type={type} {...register(name)} className="mt-1" {...props} />{errors[name] && <p className="mt-1 text-xs text-destructive">{errors[name]?.message as string}</p>}</div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? (editing.kind === 'SEALED' ? 'Edit sealed product' : 'Edit slab') : isSealed ? 'Add sealed product' : 'Add graded slab'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(submit)} className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>Product type</Label>
            {editing ? (
              <>
                <input type="hidden" {...register('kind')} />
                <p className="mt-1 text-sm text-muted-foreground">
                  {editing.kind === 'SEALED' ? 'Sealed product' : 'Graded slab'} — cannot be changed
                </p>
              </>
            ) : (
              <Select {...register('kind')} className="mt-1 w-full">
                <option value="SLAB">Graded slab</option>
                <option value="SEALED">Sealed product</option>
              </Select>
            )}
          </div>
          {field('Card name', 'name')}
          {field('Card number', 'cardNumber')}
          {field('Set', 'setName')}
          {field('Character', 'character')}
          {!isSealed && (
            <>
              <div><Label>Grading company</Label><Select {...register('gradingCompany')} className="mt-1 w-full">{GRADING_COMPANIES.map((c) => <option key={c}>{c}</option>)}</Select></div>
              <div><Label>Grade</Label><Select {...register('grade')} className="mt-1 w-full">{GRADES.map((g) => <option key={g} value={g}>{g}</option>)}</Select></div>
              <div><Label>Certification #</Label><Input {...register('slabNumber')} className="mt-1" disabled={!!editing} />{errors.slabNumber && <p className="mt-1 text-xs text-destructive">{errors.slabNumber.message}</p>}</div>
            </>
          )}
          {isSealed && field('Quantity', 'quantity', 'number', { step: '1', min: 0 })}
          {field('Rarity', 'rarity')}
          {field('Buying cost (₱)', 'buyCost', 'number', { step: '0.01' })}
          {field('Selling price (₱)', 'sellPrice', 'number', { step: '0.01' })}
          <div className="col-span-2"><Label>Notes</Label><Textarea {...register('notes')} className="mt-1" /></div>
          <div className="col-span-2">
            <Label>Slab image</Label>
            <ImageUploader
              className="mt-1"
              existingUrl={removeExisting ? null : existingImage?.url}
              onFileChange={setFile}
              onRemoveExisting={() => setRemoveExisting(true)}
              uploading={uploading}
              progress={progress}
              disabled={pending}
            />
          </div>
          <DialogFooter className="col-span-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? (uploading ? 'Uploading…' : 'Saving…') : editing ? 'Save changes' : 'Add slab'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
