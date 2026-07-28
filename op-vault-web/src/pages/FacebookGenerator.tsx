import { useState } from 'react';
import { PageHeader } from '@/components/common/PageHeader';
import { cn } from '@/lib/utils';
import { GeneratorWorkspace } from '@/features/fb-generator/GeneratorWorkspace';
import { PagedWorkspace } from '@/features/fb-generator/PagedWorkspace';
import { MODES, type GenType } from '@/features/fb-generator/types';

// Sealed products live in the slabs table now, so the Slabs tab covers both.
const TABS: GenType[] = ['RAW', 'SLAB'];

export function FacebookGeneratorPage() {
  const [active, setActive] = useState<GenType>('RAW');

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <PageHeader title="Facebook Post Generator" subtitle="Separate generators for raw cards and slabs & sealed" />

      <div className="mb-4 flex gap-1 rounded-lg border bg-muted p-0.5 w-fit">
        {TABS.map((t) => (
          <button key={t} onClick={() => setActive(t)}
            className={cn('rounded-md px-4 py-1.5 text-sm font-semibold', active === t ? 'bg-card shadow' : 'text-muted-foreground')}>
            {MODES[t].label}
          </button>
        ))}
      </div>

      {/* Keep every workspace mounted so each tab preserves its own layout & settings. */}
      {TABS.map((t) => (
        <div key={t} className={active === t ? '' : 'hidden'}>
          {t === 'RAW' ? (
            <PagedWorkspace mode={MODES[t]} />
          ) : (
            <GeneratorWorkspace mode={MODES[t]} />
          )}
        </div>
      ))}
    </div>
  );
}