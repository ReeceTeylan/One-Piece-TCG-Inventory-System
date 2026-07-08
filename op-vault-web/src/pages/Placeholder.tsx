import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardContent } from '@/components/ui/card';

// Honest placeholder for routes scheduled in the next build pass — no mock data.
export function Placeholder({ title }: { title: string }) {
  return (
    <div>
      <PageHeader title={title} subtitle="Wired into navigation — page implementation scheduled next." />
      <Card><CardContent className="py-14 text-center text-sm text-muted-foreground">
        This page is part of the next build pass. Backend endpoints are ready and the typed
        service is in <code className="rounded bg-muted px-1">src/services</code>.
      </CardContent></Card>
    </div>
  );
}
