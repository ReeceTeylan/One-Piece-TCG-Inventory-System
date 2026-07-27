import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiError } from '@/lib/api';
import { useSlabMutations } from './use-slabs';
import type { SlabCard } from '@/types';

export function SlabRestockDialog({
  item,
  onOpenChange,
}: {
  item: SlabCard | null;
  onOpenChange: (o: boolean) => void;
}) {
  const { restock } = useSlabMutations();
  const [qty, setQty] = useState('1');
  const [cost, setCost] = useState('');

  useEffect(() => { setQty('1'); setCost(''); }, [item]);

  const submit = async () => {
    if (!item) return;
    const quantityAdded = Number(qty);
    if (!Number.isInteger(quantityAdded) || quantityAdded <= 0) {
      toast.error('Enter a whole number greater than 0');
      return;
    }
    // Blank cost sends 0, which the backend reads as "keep the existing cost".
    const buyCost = cost.trim() === '' ? 0 : Number(cost);
    if (!Number.isFinite(buyCost) || buyCost < 0) {
      toast.error('Enter a valid cost');
      return;
    }
    try {
      await restock.mutateAsync({ id: item.id, quantityAdded, buyCost });
      toast.success(buyCost > 0 ? 'Stock added, average cost updated' : 'Stock added');
      onOpenChange(false);
    } catch (e) {
      toast.error(apiError(e).message);
    }
  };

  return (
    <Dialog open={!!item} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add stock — {item?.name}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Quantity to add</Label>
            <Input type="number" min={1} step={1} value={qty}
              onChange={(e) => setQty(e.target.value)} className="mt-1" />
            <p className="mt-1 text-xs text-muted-foreground">Current stock: {item?.quantity ?? 0}</p>
          </div>
          <div>
            <Label>Unit cost of this batch (₱)</Label>
            <Input type="number" min={0} step="0.01" value={cost}
              onChange={(e) => setCost(e.target.value)}
              placeholder="Leave blank to keep current cost" className="mt-1" />
            <p className="mt-1 text-xs text-muted-foreground">
              Entering a cost recalculates the weighted average.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={submit} disabled={restock.isPending}>
            {restock.isPending ? 'Saving…' : 'Add stock'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}