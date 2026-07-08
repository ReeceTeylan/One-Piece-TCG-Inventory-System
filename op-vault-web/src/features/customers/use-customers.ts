import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customersService } from '@/services';

export function useCustomers(params: Record<string, any>) {
  return useQuery({ queryKey: ['customers', params], queryFn: () => customersService.list(params) });
}
export function useCustomerPurchases(id?: string) {
  return useQuery({ queryKey: ['customer-purchases', id], queryFn: () => customersService.purchases(id!), enabled: !!id });
}
export function useCustomerStats(id?: string) {
  return useQuery({ queryKey: ['customer-stats', id], queryFn: () => customersService.statistics(id!), enabled: !!id });
}
export function useCustomerMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['customers'] });
  return {
    create: useMutation({ mutationFn: customersService.create, onSuccess: invalidate }),
    update: useMutation({ mutationFn: (v: { id: string; dto: any }) => customersService.update(v.id, v.dto), onSuccess: invalidate }),
    remove: useMutation({ mutationFn: customersService.remove, onSuccess: invalidate }),
  };
}
