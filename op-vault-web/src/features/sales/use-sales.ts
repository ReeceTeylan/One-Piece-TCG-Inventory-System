import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { salesService, rawCardsService, slabsService, customersService } from '@/services';

export function useSales(params: Record<string, any>) {
  return useQuery({ queryKey: ['sales', params], queryFn: () => salesService.list(params) });
}
export function useSale(id?: string) {
  return useQuery({ queryKey: ['sale', id], queryFn: () => salesService.get(id!), enabled: !!id });
}
export function useSaleMutations() {
  const qc = useQueryClient();
  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['sales'] });
    qc.invalidateQueries({ queryKey: ['raw-cards'] });
    qc.invalidateQueries({ queryKey: ['slabs'] });
    qc.invalidateQueries({ queryKey: ['shipments'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
  };
  return {
    complete: useMutation({ mutationFn: salesService.complete, onSuccess: invalidateAll }),
    cancel: useMutation({ mutationFn: (v: { id: string; reason?: string }) => salesService.cancel(v.id, v.reason), onSuccess: invalidateAll }),
    refund: useMutation({ mutationFn: (v: { id: string; reason?: string }) => salesService.refund(v.id, v.reason), onSuccess: invalidateAll }),
    undo: useMutation({ mutationFn: (id: string) => salesService.undo(id), onSuccess: invalidateAll }),
  };
}

export function useProductSearch(search: string) {
  const q = search.trim();
  const raw = useQuery({
    queryKey: ['raw-search', q],
    queryFn: async () => {
      const res = await rawCardsService.list({ search: q || undefined, limit: 24, sortBy: 'createdAt', sortOrder: 'desc' });
      // Show every in-stock raw card (AVAILABLE or LOW); only hide out-of-stock / sold.
      return { ...res, data: res.data.filter((c) => c.quantity > 0 && c.status !== 'SOLD' && c.status !== 'OUT') };
    },
  });
  const slabs = useQuery({
    queryKey: ['slab-search', q],
    queryFn: async () => {
      const res = await slabsService.list({ search: q || undefined, limit: 18, sortBy: 'createdAt', sortOrder: 'desc' });
      return { ...res, data: res.data.filter((sl) => sl.status !== 'SOLD') };
    },
  });
  return { raw, slabs };
}
export function useCustomerLookup(search: string) {
  return useQuery({ queryKey: ['customer-lookup', search], queryFn: () => customersService.list({ search: search || undefined, limit: 8 }) });
}
