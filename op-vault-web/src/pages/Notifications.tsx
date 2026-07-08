import { useState } from 'react';
import { Bell, Check, Trash2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PageHeader } from '@/components/common/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TableSkeleton, ErrorState, EmptyState } from '@/components/common/DataState';
import { Pagination } from '@/components/common/Pagination';
import { cn, fmtDate } from '@/lib/utils';
import { notificationsService } from '@/services';
import { apiError } from '@/lib/api';

const TYPE_VARIANT: Record<string, any> = { LOW_STOCK: 'warning', OUT_OF_STOCK: 'destructive', SALE: 'success', SHIPMENT: 'info', SYSTEM: 'default' };

export function NotificationsPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useQuery({
    queryKey: ['notifications', page, filter],
    queryFn: () => notificationsService.list({ page, limit: 20, isRead: filter === '' ? undefined : filter === 'read' }),
  });
  const invalidate = () => { qc.invalidateQueries({ queryKey: ['notifications'] }); qc.invalidateQueries({ queryKey: ['notif-count'] }); };
  const markRead = useMutation({ mutationFn: (id: string) => notificationsService.markRead(id), onSuccess: invalidate });
  const markAll = useMutation({ mutationFn: () => notificationsService.markAllRead(), onSuccess: () => { invalidate(); toast.success('All marked read'); } });
  const dismiss = useMutation({ mutationFn: (id: string) => notificationsService.dismiss(id), onSuccess: () => { invalidate(); toast.success('Dismissed'); }, onError: (e) => toast.error(apiError(e).message) });

  return (
    <>
      <PageHeader title="Notifications" subtitle="Alerts & activity"
        actions={<Button variant="outline" onClick={() => markAll.mutate()}><Check /> Mark all read</Button>} />

      <div className="mb-3.5 flex gap-1 rounded-lg border bg-muted p-0.5 w-fit">
        {[['', 'All'], ['unread', 'Unread'], ['read', 'Read']].map(([v, l]) => (
          <button key={v} onClick={() => { setFilter(v); setPage(1); }} className={cn('rounded-md px-3 py-1 text-xs font-semibold', filter === v ? 'bg-card shadow' : 'text-muted-foreground')}>{l}</button>
        ))}
      </div>

      <Card>
        {isLoading ? <TableSkeleton /> : isError ? <ErrorState /> : !data?.data.length ? <EmptyState message="No notifications." /> : (
          <div>
            {data.data.map((n) => (
              <div key={n.id} className={cn('flex items-start gap-3 border-b px-4 py-3 last:border-0', !n.isRead && 'bg-muted/40')}>
                <span className="mt-1 grid size-8 shrink-0 place-items-center rounded-full bg-muted"><Bell className="size-4 text-muted-foreground" /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><b className="text-[13px]">{n.title}</b><Badge variant={TYPE_VARIANT[n.type]}>{n.type.replace('_', ' ')}</Badge></div>
                  {n.body && <p className="text-xs text-muted-foreground">{n.body}</p>}
                  <p className="text-[11px] text-muted-foreground">{fmtDate(n.createdAt)}</p>
                </div>
                <div className="flex gap-1">
                  {!n.isRead && <Button variant="ghost" size="icon" onClick={() => markRead.mutate(n.id)} aria-label="Mark read"><Check /></Button>}
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => dismiss.mutate(n.id)} aria-label="Dismiss"><Trash2 /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
        {data && data.meta.totalPages > 1 && <Pagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} onPage={setPage} />}
      </Card>
    </>
  );
}
