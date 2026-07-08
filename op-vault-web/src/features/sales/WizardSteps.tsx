import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const STEPS = [
  { n: 1, title: 'Customer', sub: 'Who is buying' },
  { n: 2, title: 'Products', sub: 'Add cards & slabs' },
  { n: 3, title: 'Summary', sub: 'Review order' },
  { n: 4, title: 'Confirm', sub: 'Complete sale' },
];

export function WizardSteps({ step }: { step: number }) {
  return (
    <div className="mb-6 flex">
      {STEPS.map((s, i) => (
        <div key={s.n} className={cn(
          'flex flex-1 items-center gap-2.5 border bg-card px-3.5 py-3',
          i === 0 && 'rounded-l-lg', i === STEPS.length - 1 && 'rounded-r-lg', i !== STEPS.length - 1 && 'border-r-0',
          step === s.n && 'ring-1 ring-inset ring-primary',
        )}>
          <span className={cn('grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold',
            step > s.n ? 'bg-success text-white' : step === s.n ? 'bg-primary text-primary-foreground' : 'border bg-muted text-muted-foreground')}>
            {step > s.n ? <Check className="size-3.5" /> : s.n}
          </span>
          <div className="min-w-0"><b className="text-[13px]">{s.title}</b><span className="block truncate text-[11px] text-muted-foreground max-sm:hidden">{s.sub}</span></div>
        </div>
      ))}
    </div>
  );
}
