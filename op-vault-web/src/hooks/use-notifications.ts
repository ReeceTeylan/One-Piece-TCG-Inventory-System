import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsService } from '@/services';

export function useUnreadCount() {
  return useQuery({ queryKey: ['notifications', 'unread'], queryFn: notificationsService.unreadCount, refetchInterval: 60000 });
}
export function useNotifications() {
  return useQuery({ queryKey: ['notifications', 'list'], queryFn: () => notificationsService.list({ limit: 20 }) });
}
export function useNotificationActions() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['notifications'] });
  return {
    markRead: useMutation({ mutationFn: notificationsService.markRead, onSuccess: invalidate }),
    markAllRead: useMutation({ mutationFn: notificationsService.markAllRead, onSuccess: invalidate }),
    dismiss: useMutation({ mutationFn: notificationsService.dismiss, onSuccess: invalidate }),
  };
}
