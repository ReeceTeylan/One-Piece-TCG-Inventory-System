import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { apiError } from '@/lib/api';
import { useCustomerMutations } from './use-customers';
import type { Customer } from '@/types';

const schema = z.object({
  name: z.string().min(1, 'Required'),
  facebookName: z.string().optional(),
  contactNumber: z.string().optional(),
  notes: z.string().optional(),
});
type Form = z.infer<typeof schema>;

export function CustomerForm({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (o: boolean) => void; editing?: Customer | null }) {
  const { create, update } = useCustomerMutations();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema) });

  useEffect(() => {
    reset(editing
      ? { name: editing.name, facebookName: editing.facebookName ?? '', contactNumber: editing.contactNumber ?? '', notes: editing.notes ?? '' }
      : { name: '', facebookName: '', contactNumber: '', notes: '' });
  }, [editing, open, reset]);

  const submit = async (data: Form) => {
    try {
      if (editing) { await update.mutateAsync({ id: editing.id, dto: data }); toast.success('Customer updated'); }
      else { await create.mutateAsync(data); toast.success('Customer added'); }
      reset(); onOpenChange(false);
    } catch (e) {
      const err = apiError(e);
      toast.error(err.code === 'CUSTOMER_EXISTS' ? 'A customer with this name and contact already exists' : err.message);
    }
  };

  const pending = create.isPending || update.isPending;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{editing ? 'Edit customer' : 'Add customer'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(submit)} className="space-y-3">
          <div><Label>Name</Label><Input {...register('name')} className="mt-1" />{errors.name && <p className="mt-1 text-xs text-destructive">{errors.name.message}</p>}</div>
          <div><Label>Facebook name</Label><Input {...register('facebookName')} className="mt-1" /></div>
          <div><Label>Contact number</Label><Input {...register('contactNumber')} className="mt-1" /></div>
          <div><Label>Notes</Label><Textarea {...register('notes')} className="mt-1" /></div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? 'Saving…' : editing ? 'Save' : 'Add customer'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
