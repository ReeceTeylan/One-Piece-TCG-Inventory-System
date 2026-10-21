import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle } from 'lucide-react';
import { BottleAtSea } from '@/components/common/Nautical';

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return <div className="space-y-2 p-4">{Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-11 w-full" />)}</div>;
}
export function ErrorState({ message }: { message?: string }) {
  return <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
    <AlertCircle className="size-8 text-destructive" /><p>{message ?? 'Something went wrong.'}</p></div>;
}
export function EmptyState({ message = 'Nothing here yet.' }: { message?: string }) {
  return <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
    <BottleAtSea /><p>{message}</p></div>;
}
