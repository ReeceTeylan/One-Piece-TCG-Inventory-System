import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative max-w-xs flex-1">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder ?? 'Search…'} className="pl-9" aria-label="Search" />
    </div>
  );
}
