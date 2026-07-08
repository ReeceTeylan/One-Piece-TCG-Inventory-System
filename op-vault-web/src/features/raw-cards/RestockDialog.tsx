import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRawCardMutations } from './use-raw-cards';
import { apiError } from '@/lib/api';
import type { RawCard } from '@/types';

export function RestockDialog({ card, onClose }: { card: RawCard | null; onClose: () => void }) {
  const { restock } = useRawCardMutations();
  const { register, handleSubmit } = useForm({ defaultValues: { quantityAdded: 10, buyCost: 0 } });
  const submit = async (v: any) => {
    if (!card) return;
    try {
      await restock.mutateAsync({ id: card.id, dto: { quantityAdded: Number(v.quantityAdded), buyCost: Number(v.buyCost) } });
      toast.success(`Restocked ${card.name}`); onClose();
    } catch (e) { toast.error(apiError(e).message); }
  };
  return (
    <Dialog open={!!card} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Restock · {card?.name}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(submit)} className="space-y-3">
          <div><Label>Quantity added</Label><Input type="number" {...register('quantityAdded')} className="mt-1" /></div>
          <div><Label>Buying cost (₱)</Label><Input type="number" step="0.01" {...register('buyCost')} className="mt-1" /></div>
          <p className="text-xs text-muted-foreground">Current stock: {card?.quantity ?? 0}</p>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={restock.isPending}>{restock.isPending ? 'Updating…' : 'Update inventory'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
