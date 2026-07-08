import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsService } from '@/services';

export function useSettings() {
  return useQuery({ queryKey: ['settings'], queryFn: () => settingsService.get() });
}
export function useSettingsMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: any) => settingsService.update(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  });
}
