import { useState } from 'react';
import { cn } from '@/lib/utils';
import { GeneratorWorkspace } from '@/features/fb-generator/GeneratorWorkspace';
import { PagedWorkspace } from '@/features/fb-generator/PagedWorkspace';
import { MODES, type GenType } from '@/features/fb-generator/types';

// Sealed products live in the slabs table now, so the Slabs tab covers both.
const TABS: GenType[] = ['RAW', 'SLAB'];

export function FacebookGeneratorPage() {
  const [active, setActive] = useState<GenType>('RAW');

  // Rendered inside each workspace's toolbar rather than as its own row.
  const tabs = (
    <div className="flex gap-1 rounded-lg border bg-muted p-0.5">
      {TABS.map((t) => (
        <button key={t} onClick={() => setActive(t)}
          className={cn('rounded-md px-3 py-1 text-xs font-semibold', active === t ? 'bg-card shadow' : 'text-muted-foreground')}>
          {MODES[t].label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <p className="mb-3 rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground xl:hidden">
        The post generator needs a wider screen — open OP-Vault on a desktop to build and export posts.
      </p>
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