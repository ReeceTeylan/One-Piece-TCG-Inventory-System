import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { rawCardsService } from '@/services';

export function useRawCards(params: Record<string, any>) {
  return useQuery({ queryKey: ['raw-cards', params], queryFn: () => rawCardsService.list(params) });
}
export function useRawCardMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['raw-cards'] });
  return {
    create: useMutation({ mutationFn: rawCardsService.create, onSuccess: invalidate }),
    update: useMutation({ mutationFn: (v: { id: string; dto: any }) => rawCardsService.update(v.id, v.dto), onSuccess: invalidate }),
    addQuantity: useMutation({ mutationFn: (v: { id: string; quantity: number }) => rawCardsService.addQuantity(v.id, v.quantity), onSuccess: invalidate }),
    restock: useMutation({ mutationFn: (v: { id: string; dto: any }) => rawCardsService.restock(v.id, v.dto), onSuccess: invalidate }),
    remove: useMutation({ mutationFn: rawCardsService.remove, onSuccess: invalidate }),
  };
}

export const RARITIES = ['C', 'UC', 'R', 'SR', 'SEC', 'PSEC', 'SP', 'PSR', 'PR', 'Promo', 'Leader', 'PL', 'PC', 'Don', 'Gold Don'];
export const COLORS = ['Red', 'Green', 'Blue', 'Purple', 'Black', 'Yellow'];
