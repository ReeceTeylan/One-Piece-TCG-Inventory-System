import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/common/PageHeader';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { TableSkeleton, ErrorState, EmptyState } from '@/components/common/DataState';
import { Pagination } from '@/components/common/Pagination';
import { SearchInput } from '@/components/common/Toolbar';
import { fmtDate } from '@/lib/utils';
import { useDebounce } from '@/hooks/use-debounce';
import { activityLogsService } from '@/services';

export function ActivityLogsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debounced = useDebounce(search);
  const { data, isLoading, isError } = useQuery({
    queryKey: ['activity-logs', page, debounced],
    queryFn: () => activityLogsService.list({ page, limit: 25, action: debounced || undefined }),
  });

  return (
    <>
      <PageHeader title="Activity Logs" subtitle="Audit trail of every action" />
      <div className="mb-3.5 flex items-center gap-2.5">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Filter by action…" />
      </div>
      <Card>
        {isLoading ? <TableSkeleton /> : isError ? <ErrorState /> : !data?.data.length ? <EmptyState message="No activity yet." /> : (
          <Table>
            <THead><TR><TH>Action</TH><TH>Entity</TH><TH>User</TH><TH>When</TH></TR></THead>
            <TBody>
              {data.data.map((log: any) => (
                <TR key={log.id}>
                  <TD><Badge variant="info">{log.action}</Badge></TD>
                  <TD className="text-muted-foreground">{log.entityType ?? '—'}{log.entityId ? ` · ${String(log.entityId).slice(0, 8)}` : ''}</TD>
                  <TD>{log.user?.fullName ?? 'System'}</TD>
                  <TD className="text-muted-foreground">{fmtDate(log.createdAt)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
        {data && data.meta.totalPages > 1 && <Pagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} onPage={setPage} />}
      </Card>
    </>
  );
}
