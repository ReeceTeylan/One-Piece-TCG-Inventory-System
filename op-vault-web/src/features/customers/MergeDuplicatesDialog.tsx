import { useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { fmtDate } from '@/lib/utils';
import { apiError } from '@/lib/api';
import { useCustomerDuplicates, useCustomerMutations } from './use-customers';

export function MergeDuplicatesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data: groups, isLoading } = useCustomerDuplicates();
  const { merge } = useCustomerMutations();
  // Which record to keep, per group name.
  const [keep, setKeep] = useState<Record<string, string>>({});

  const mergeGroup = async (name: string, customers: any[]) => {
    const keepId = keep[name] ?? customers[0].id;
    const mergeIds = customers.map((c) => c.id).filter((id) => id !== keepId);
    try {
      const res: any = await merge.mutateAsync({ keepId, mergeIds });
      toast.success(res?.message ?? 'Merged');
    } catch (e) {
      toast.error(apiError(e).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col">
        <DialogHeader><DialogTitle>Possible duplicate customers</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">
          Same name, different records. Pick the one to keep — its orders and any missing
          contact details are combined, and the others are removed.
        </p>
        <div className="-mr-2 min-h-0 flex-1 space-y-3 overflow-y-auto pr-2">
          {isLoading ? <div className="flex justify-center py-8"><Spinner /></div>
            : !groups?.length ? <p className="py-8 text-center text-sm text-muted-foreground">No duplicates found.</p>
            : groups.map((g: any) => {
              const keepId = keep[g.name] ?? g.customers[0]?.id;
              return (
                <div key={g.name} className="rounded-lg border p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <b className="truncate text-[13px] capitalize">{g.name}</b>
                    <Badge variant="warning" className="shrink-0">{g.count} records</Badge>
                  </div>
                  <div className="mb-2.5 space-y-1">
                    {g.customers.map((c: any) => (
                      <label key={c.id} className="flex cursor-pointer items-center gap-2.5 rounded-md border p-2 text-[12.5px] hover:bg-muted/50">
                        <input type="radio" name={`keep-${g.name}`} checked={keepId === c.id}
                          onChange={() => setKeep((k) => ({ ...k, [g.name]: c.id }))} className="size-4 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{c.name}</span>
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {c.facebookName || 'no FB'} · {c.contactNumber || 'no contact'} · added {fmtDate(c.createdAt)}
                          </span>
                        </div>
                        <span className="shrink-0 text-[11px] text-muted-foreground">{c._count?.sales ?? 0} orders</span>
                      </label>
                    ))}
                  </div>
                  <div className="flex justify-end">
                    <Button size="sm" disabled={merge.isPending} onClick={() => mergeGroup(g.name, g.customers)}>
                      {merge.isPending ? 'Merging…' : 'Merge into selected'}
                    </Button>
                  </div>
                </div>
              );
            })}
        </div>
      </DialogContent>
    </Dialog>
  );
}