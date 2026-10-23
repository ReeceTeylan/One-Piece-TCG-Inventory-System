import { useState } from 'react';
import { cn } from '@/lib/utils';
import { GeneratorWorkspace } from '@/features/fb-generator/GeneratorWorkspace';
import { PagedWorkspace } from '@/features/fb-generator/PagedWorkspace';
import { MODES, type GenType } from '@/features/fb-generator/types';
import { useStickyState } from '@/hooks/use-sticky-state';

// Sealed products live in the slabs table now, so the Slabs tab covers both.
const TABS: GenType[] = ['RAW', 'SLAB'];

export function FacebookGeneratorPage() {
  const [active, setActive] = useStickyState<GenType>('fb:type', 'RAW', { allowed: ['RAW', 'SLAB', 'SEALED'] });

  // Rendered inside each workspace's toolbar rather than as its own row.
  const tabs = (
    <div className="flex min-w-0 gap-1 rounded-lg border bg-muted p-0.5 max-sm:w-full">
      {TABS.map((t) => (
        <button key={t} onClick={() => setActive(t)}
          className={cn('min-w-0 rounded-md px-3 py-1 text-xs font-semibold max-sm:flex-1 max-sm:py-2', active === t ? 'bg-card shadow' : 'text-muted-foreground')}>
          {MODES[t].label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col max-sm:overflow-y-auto sm:overflow-hidden">
      {TABS.map((t) => (
        <div key={t} className={active === t ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
          {t === 'RAW'
            ? <PagedWorkspace mode={MODES[t]} tabs={tabs} />
            : <GeneratorWorkspace mode={MODES[t]} tabs={tabs} />}
        </div>
      ))}
    </div>
  );
}