import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { X, GripVertical, Tag, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FbCardTile } from './FbCardTile';
import type { FbCard, OverlayConfig } from './types';

export function SortableCard({ card, config, selected, inSet, aspect, onRemove, onCycleBadge, onToggleSelect }: {
  card: FbCard; config: OverlayConfig; selected: boolean; inSet: boolean; aspect?: string;
  onRemove: (key: string) => void; onCycleBadge: (key: string) => void; onToggleSelect: (key: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.key });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 10 : undefined };
  return (
    <div ref={setNodeRef} style={style} className="group relative">
      {/* click the card body to (de)select for grouping */}
      <button type="button" onClick={() => onToggleSelect(card.key)} className="block w-full text-left" aria-pressed={selected} aria-label={selected ? 'Deselect card' : 'Select card'}>
        <FbCardTile card={card} config={config} aspect={aspect} />
      </button>

      {/* selection ring / set indicator */}
      {(selected || inSet) && (
        <div className={cn('pointer-events-none absolute inset-0 rounded-[inherit] ring-2 ring-offset-0',
          selected ? 'ring-primary' : 'ring-amber-400/70')} style={{ borderRadius: config.borderRadius }} />
      )}
      {selected && (
        <div className="pointer-events-none absolute left-1 top-1 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground">
          <Check className="size-3.5" />
        </div>
      )}

      <div className="absolute inset-x-0 top-0 flex items-center justify-between p-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button {...attributes} {...listeners} className="grid size-6 cursor-grab place-items-center rounded bg-black/60 text-white" aria-label="Drag to reorder">
          <GripVertical className="size-3.5" />
        </button>
        <div className="flex gap-1">
          <button onClick={() => onCycleBadge(card.key)} className="grid size-6 place-items-center rounded bg-black/60 text-white" aria-label="Cycle badge"><Tag className="size-3.5" /></button>
          <button onClick={() => onRemove(card.key)} className="grid size-6 place-items-center rounded bg-black/60 text-white" aria-label="Remove"><X className="size-3.5" /></button>
        </div>
      </div>
    </div>
  );
}
