import { useState } from 'react';
import { FileText, Download } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/common/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { reportsService } from '@/services';
import { apiError } from '@/lib/api';

const REPORTS = [
  { type: 'inventory', title: 'Inventory Report', desc: 'Full stock list with values' },
  { type: 'sales', title: 'Sales Report', desc: 'Transactions by period' },
  { type: 'profit', title: 'Profit Report', desc: 'Margins & profit summary' },
  { type: 'shipping', title: 'Shipping Report', desc: 'Fulfillment & couriers' },
  { type: 'customer', title: 'Customer Report', desc: 'Spend & orders per customer' },
  { type: 'card-performance', title: 'Card Performance', desc: 'Sold, stock & averages' },
];

export function ReportsPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const download = async (type: string) => {
    setLoading(type);
    try { await reportsService.download(type); toast.success('Report downloaded'); }
    catch (e) { toast.error(apiError(e).message); }
    finally { setLoading(null); }
  };
  return (
    <>
      <PageHeader title="Reports" subtitle="Generate & export PDF reports" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((r) => (
          <Card key={r.type} className="flex items-center gap-3.5 p-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted"><FileText className="size-5 text-muted-foreground" /></span>
            <div className="min-w-0 flex-1"><b className="text-sm">{r.title}</b><p className="text-xs text-muted-foreground">{r.desc}</p></div>
            <Button variant="outline" size="sm" onClick={() => download(r.type)} disabled={loading === r.type}>
              {loading === r.type ? 'Generating…' : <><Download /> PDF</>}
            </Button>
          </Card>
        ))}
      </div>
    </>
  );
}
