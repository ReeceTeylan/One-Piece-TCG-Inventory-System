import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { shipmentsService } from '@/services';

export function useShipments(params: Record<string, any>) {
  return useQuery({ queryKey: ['shipments', params], queryFn: () => shipmentsService.list(params) });
}
export function useShipmentTimeline(id?: string) {
  return useQuery({ queryKey: ['shipment-timeline', id], queryFn: () => shipmentsService.timeline(id!), enabled: !!id });
}
export function useShipmentMutations() {
  const qc = useQueryClient();
  return {
    update: useMutation({
      mutationFn: (v: { id: string; dto: any }) => shipmentsService.update(v.id, v.dto),
      onSuccess: () => { qc.invalidateQueries({ queryKey: ['shipments'] }); qc.invalidateQueries({ queryKey: ['shipment-timeline'] }); },
    }),
  };
}

export const NEXT_STATUS: Record<string, string | null> = {
  TO_PACK: 'READY', READY: 'SHIPPED', SHIPPED: 'DELIVERED', DELIVERED: null, CANCELLED: null,
};
