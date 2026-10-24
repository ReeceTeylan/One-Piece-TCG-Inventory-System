import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BottleAtSea } from '@/components/common/Nautical';

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return <div className="space-y-2 p-2 sm:p-4" role="status" aria-label="Loading results"><span className="sr-only">Loading results…</span>{Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-14 w-full sm:h-11" aria-hidden="true" />)}</div>;
}
export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
    <AlertCircle className="size-8 text-destructive" /><p>{message ?? 'Could not load these results.'}</p>{onRetry && <Button size="sm" variant="outline" onClick={onRetry}><RotateCcw className="size-4" /> Try again</Button>}</div>;
}
export function EmptyState({ message = 'Nothing here yet.' }: { message?: string }) {
  return <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
    <BottleAtSea /><p>{message}</p></div>;
}
