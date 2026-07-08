import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Inbox } from 'lucide-react';

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return <div className="space-y-2 p-4">{Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-11 w-full" />)}</div>;
}
export function ErrorState({ message }: { message?: string }) {
  return <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
    <AlertCircle className="size-8 text-destructive" /><p>{message ?? 'Something went wrong.'}</p></div>;
}
export function EmptyState({ message = 'Nothing here yet.' }: { message?: string }) {
  return <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
    <Inbox className="size-8 opacity-40" /><p>{message}</p></div>;
}
