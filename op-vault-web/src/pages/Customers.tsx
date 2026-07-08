import { useState } from 'react';
import { Plus, Pencil, Trash2, User } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/common/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { TableSkeleton, ErrorState, EmptyState } from '@/components/common/DataState';
import { Pagination } from '@/components/common/Pagination';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { SearchInput } from '@/components/common/Toolbar';
import { fmtDate } from '@/lib/utils';
import { useDebounce } from '@/hooks/use-debounce';
import { useAuth } from '@/contexts/auth-context';
import { apiError } from '@/lib/api';
import type { Customer } from '@/types';
import { useCustomers, useCustomerMutations } from '@/features/customers/use-customers';
import { CustomerForm } from '@/features/customers/CustomerForm';
import { CustomerDetail } from '@/features/customers/CustomerDetail';

export function CustomersPage() {
  const { isOwner } = useAuth();
  const { remove } = useCustomerMutations();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debounced = useDebounce(search);
  const { data, isLoading, isError } = useCustomers({ page, limit: 20, search: debounced || undefined, sortBy: 'name', sortOrder: 'asc' });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [detail, setDetail] = useState<Customer | null>(null);
  const [toDelete, setToDelete] = useState<Customer | null>(null);

  const confirmDelete = async () => {
    if (!toDelete) return;
    try { await remove.mutateAsync(toDelete.id); toast.success('Customer deleted'); setToDelete(null); }
    catch (e) { toast.error(apiError(e).message); }
  };

  return (
    <>
      <PageHeader title="Customers" subtitle={`${data?.meta.total ?? 0} customers`}
        actions={<Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus /> Add customer</Button>} />

      <div className="mb-3.5 flex items-center gap-2.5">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search name, FB, contact…" />
      </div>

      <Card>
        {isLoading ? <TableSkeleton /> : isError ? <ErrorState /> : !data?.data.length ? <EmptyState message="No customers found." /> : (
          <Table>
            <THead><TR><TH>Name</TH><TH>Facebook</TH><TH>Contact</TH><TH className="text-right">Orders</TH><TH>Since</TH><TH></TH></TR></THead>
            <TBody>
              {data.data.map((c) => (
                <TR key={c.id} className="cursor-pointer" onClick={() => setDetail(c)}>
                  <TD><div className="flex items-center gap-2.5">
                    <span className="grid size-8 place-items-center rounded-full bg-muted text-xs font-bold text-muted-foreground">{c.name[0]?.toUpperCase()}</span>
                    <b className="font-semibold">{c.name}</b></div></TD>
                  <TD className="text-muted-foreground">{c.facebookName || '—'}</TD>
                  <TD className="tabular-nums">{c.contactNumber || '—'}</TD>
                  <TD className="text-right tabular-nums">{c._count?.sales ?? 0}</TD>
                  <TD>{fmtDate(c.createdAt)}</TD>
                  <TD onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setDetail(c)} aria-label="View"><User /></Button>
                      <Button variant="ghost" size="icon" onClick={() => { setEditing(c); setFormOpen(true); }} aria-label="Edit"><Pencil /></Button>
                      {isOwner && <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setToDelete(c)} aria-label="Delete"><Trash2 /></Button>}
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
        {data && data.meta.totalPages > 1 && <Pagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} onPage={setPage} />}
      </Card>

      <CustomerForm open={formOpen} onOpenChange={setFormOpen} editing={editing} />
      <CustomerDetail customer={detail} onOpenChange={(o) => !o && setDetail(null)} />
      <ConfirmDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)} destructive
        title="Delete customer" description={`Delete "${toDelete?.name}"? Customers with sales history cannot be deleted.`}
        confirmLabel="Delete" loading={remove.isPending} onConfirm={confirmDelete} />
    </>
  );
}
