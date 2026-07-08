import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { slabsService, imagesService } from '@/services';

export function useSlabs(params: Record<string, any>) {
  return useQuery({ queryKey: ['slabs', params], queryFn: () => slabsService.list(params) });
}
export function useSlabMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['slabs'] });
  return {
    create: useMutation({ mutationFn: slabsService.create, onSuccess: invalidate }),
    update: useMutation({ mutationFn: (v: { id: string; dto: any }) => slabsService.update(v.id, v.dto), onSuccess: invalidate }),
    remove: useMutation({ mutationFn: slabsService.remove, onSuccess: invalidate }),
    upload: useMutation({ mutationFn: (v: { file: File; id: string }) => imagesService.upload(v.file, 'SLAB', v.id), onSuccess: invalidate }),
  };
}

export const GRADING_COMPANIES = ['PSA', 'BGS', 'CGC', 'SGC'];
export const GRADES = ['10', '9.5', '9', '8.5', '8', '7', '6', '5'];
