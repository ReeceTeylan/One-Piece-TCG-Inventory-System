import { useCallback, useMemo, useRef, useState } from 'react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy } from '@dnd-kit/sortable';
import { toPng } from 'html-to-image';
import { Download, Layers, X } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/common/DataState';
import { peso } from '@/lib/utils';
import { InventoryPicker } from './InventoryPicker';
import { SealedForm } from './SealedForm';
import { ControlsPanel } from './ControlsPanel';
import { SortableCard } from './SortableCard';
import { DEFAULT_CONFIG, RESOLUTIONS } from './types';
import type { FbCard, FbSet, GenMode, OverlayConfig, BadgeState } from './types';
import { computeSetBanners, groupContiguous, newId } from './set-utils';

export function GeneratorWorkspace({
  mode,
  cards: cardsProp,
  onCardsChange,
  sets: setsProp,
  onSetsChange,
}: {
  mode: GenMode;
  cards?: FbCard[];
  onCardsChange?: React.Dispatch<React.SetStateAction<FbCard[]>>;
  sets?: FbSet[];
  onSetsChange?: React.Dispatch<React.SetStateAction<FbSet[]>>;
}) {
  const { cols, rows: maxRows, perPage, aspectW, aspectH } = mode;
  const aspect = `${aspectW} / ${aspectH}`;

  // Controlled (multi-page) when the parent passes cards/sets; otherwise internal state (single-page tabs).
  const [cardsInternal, setCardsInternal] = useState<FbCard[]>([]);
  const [setsInternal, setSetsInternal] = useState<FbSet[]>([]);
  const cards = cardsProp ?? cardsInternal;
  const setCards = onCardsChange ?? setCardsInternal;
  const sets = setsProp ?? setsInternal;
  const setSets = onSetsChange ?? setSetsInternal;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [config, setConfigState] = useState<OverlayConfig>(DEFAULT_CONFIG);
  const [resolution, setResolution] = useState<number>(RESOLUTIONS[1].width);
  const [setPrice, setSetPrice] = useState('');
  const [setLabel, setSetLabel] = useState('');
  const [setQty, setSetQty] = useState('1');
  const [exporting, setExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  const setConfig = (patch: Partial<OverlayConfig>) => setConfigState((c) => ({ ...c, ...patch }));
  const selectedKeys = useMemo(() => new Set(cards.map((c) => c.key)), [cards]);
  const setMemberKeys = useMemo(() => new Set(sets.flatMap((s) => s.memberKeys)), [sets]);
  const rows = maxRows; // always lay out on the full page grid so cells keep their aspect (no stretch)
  const banners = useMemo(() => computeSetBanners(cards, sets, cols), [cards, sets, cols]);

  const addCard = useCallback((card: FbCard) => {
    setCards((prev) => {
      if (prev.some((c) => c.key === card.key)) return prev;
      if (prev.length >= perPage) { toast.error(`Page is full (${perPage} items). Export or remove some first.`); return prev; }
      return [...prev, card];
    });
  }, [perPage]);

  const removeCard = (key: string) => {
    setCards((prev) => prev.filter((c) => c.key !== key));
    setSets((prev) => prev.map((s) => ({ ...s, memberKeys: s.memberKeys.filter((k) => k !== key) })).filter((s) => s.memberKeys.length >= 2));
    setSelected((prev) => { const n = new Set(prev); n.delete(key); return n; });
  };

  const cycleBadge = (key: string) => setCards((prev) => prev.map((c) => {
    const next: BadgeState = c.badge === 'none' ? 'reserved' : c.badge === 'reserved' ? 'sold' : 'none';
    return c.key === key ? { ...c, badge: next } : c;
  }));

  const toggleSelect = (key: string) => setSelected((prev) => {
    const n = new Set(prev);
    if (n.has(key)) n.delete(key); else n.add(key);
    return n;
  });

  const groupSelected = () => {
    if (selected.size < 2) { toast.error('Select at least 2 items to group'); return; }
    const memberKeys = [...selected];
    setCards((prev) => groupContiguous(prev, selected));
    setSets((prev) => [...prev, { id: newId(), price: Number(setPrice) || 0, label: setLabel.trim() || undefined, quantity: Math.max(1, Number(setQty) || 1), memberKeys }]);
    setSelected(new Set()); setSetPrice(''); setSetLabel(''); setSetQty('1');
    toast.success('Grouped as a set');
  };
  const ungroup = (id: string) => setSets((prev) => prev.filter((s) => s.id !== id));
  const updateSetPrice = (id: string, price: number) => setSets((prev) => prev.map((s) => (s.id === id ? { ...s, price } : s)));
  const updateSetLabel = (id: string, label: string) => setSets((prev) => prev.map((s) => (s.id === id ? { ...s, label: label || undefined } : s)));
  const updateSetQty = (id: string, quantity: number) => setSets((prev) => prev.map((s) => (s.id === id ? { ...s, quantity: Math.max(1, quantity) } : s)));

  const clearAll = () => { setCards([]); setSets([]); setSelected(new Set()); };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (over && active.id !== over.id) {
      setCards((prev) => {
        const oldIndex = prev.findIndex((c) => c.key === active.id);
        const newIndex = prev.findIndex((c) => c.key === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  };

  const exportPng = async () => {
    if (!cards.length) { toast.error('Add items first'); return; }
    setExporting(true);
    try {
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      const node = exportRef.current!;
      const pixelRatio = resolution / node.offsetWidth;
      const dataUrl = await toPng(node, { pixelRatio, cacheBust: true, backgroundColor: config.theme === 'dark' ? '#0b0b0d' : '#ffffff' });
      const a = document.createElement('a');
      a.download = `op-vault-${mode.type.toLowerCase()}-${Date.now()}.png`;
      a.href = dataUrl; a.click();
      toast.success('PNG exported');
    } catch {
      toast.error('Export failed — some images may block cross-origin rendering.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{cols} × {maxRows} grid · {perPage} per page · {mode.label.toLowerCase()}</p>
        <div className="flex items-center gap-2">
          <Select value={resolution} onChange={(e) => setResolution(Number(e.target.value))} aria-label="Export resolution">
            {RESOLUTIONS.map((r) => <option key={r.width} value={r.width}>{r.label}</option>)}
          </Select>
          <Button variant="outline" onClick={clearAll} disabled={!cards.length}>Clear</Button>
          <Button onClick={exportPng} disabled={exporting || !cards.length}><Download /> {exporting ? 'Exporting…' : 'Export PNG'}</Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[280px_1fr_260px]">
        <Card className="order-2 flex max-h-[75vh] flex-col p-4 xl:order-1">
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold"><Layers className="size-4" /> {mode.type === 'SEALED' ? 'Add product' : 'Inventory'}</h3>
          {mode.type === 'SEALED'
            ? <SealedForm onAdd={addCard} />
            : <InventoryPicker type={mode.type} selectedKeys={selectedKeys} onAdd={addCard} />}
        </Card>

        <Card className="order-1 p-4 xl:order-2">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-bold">Preview <span className="text-muted-foreground">· {cards.length}/{perPage}</span></h3>
          </div>

          {selected.size > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-2.5">
              <span className="text-[13px] font-semibold">{selected.size} selected</span>
              <Input value={setLabel} onChange={(e) => setSetLabel(e.target.value)} placeholder="Set label (optional)" className="h-8 w-44" />
              <Input value={setPrice} onChange={(e) => setSetPrice(e.target.value)} type="number" placeholder="Set price ₱" className="h-8 w-28" />
              <Input value={setQty} onChange={(e) => setSetQty(e.target.value)} type="number" placeholder="Qty" className="h-8 w-20" title="How many of this set" />
              <Button size="sm" onClick={groupSelected} disabled={selected.size < 2}>Group as set</Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Cancel</Button>
            </div>
          )}

          {!cards.length ? (
            <EmptyState message={mode.type === 'SEALED' ? 'Add sealed products from the left to build your post.' : 'Add items from the inventory panel to build your post.'} />
          ) : (
            <div className="w-full">
              <div id="fb-export-node" ref={exportRef} className={config.theme === 'dark' ? 'mx-auto bg-[#0b0b0d]' : 'mx-auto bg-white'}
                style={{ width: '100%', maxWidth: 900, aspectRatio: '1 / 1', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: mode.type === 'SLAB' ? '0.2%' : '0.5%' }}>
                <div className="relative" style={{ height: '100%', maxWidth: '100%', aspectRatio: `${cols * aspectW} / ${rows * aspectH}` }}>
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                    <SortableContext items={cards.map((c) => c.key)} strategy={rectSortingStrategy}>
                      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`, gridTemplateRows: `repeat(${rows}, minmax(0,1fr))`, gap: 6, height: '100%' }}>
                        {cards.map((card) => (
                          <SortableCard key={card.key} card={card} config={config} aspect={aspect}
                            selected={selected.has(card.key)} inSet={setMemberKeys.has(card.key)}
                            onRemove={removeCard} onCycleBadge={cycleBadge} onToggleSelect={toggleSelect} />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>

                  <div className="pointer-events-none absolute inset-0"
                    style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`, gridTemplateRows: `repeat(${rows}, minmax(0,1fr))`, gap: 6 }}>
                    {banners.map((b) => (
                      <div key={b.key} style={{ gridColumn: `${b.colStart + 1} / ${b.colEnd + 2}`, gridRow: `${b.row + 1}`, alignSelf: 'end', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: `0 3% ${Math.max(12, config.fontSize * 1.7)}px 3%` }}>
                        <div style={{
                          width: '94%', textAlign: 'center',
                          background: `rgba(255,255,255,${0.6 + config.opacity * 0.35})`, color: '#0b0b0d', fontWeight: 800,
                          borderRadius: 999, padding: `${Math.max(5, config.fontSize * 0.34)}px ${config.fontSize * 0.7}px`,
                          fontSize: Math.max(13, config.fontSize), boxShadow: '0 2px 6px rgba(0,0,0,.3)',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>{b.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">Click to select · group ≥2 into a set · drag the grip to reorder · tag cycles Reserved / Sold · square PNG at {RESOLUTIONS.find((r) => r.width === resolution)?.label}.</p>
        </Card>

        <Card className="order-3 max-h-[75vh] overflow-y-auto p-4">
          <h3 className="mb-3 text-sm font-bold">Overlay controls</h3>
          <ControlsPanel config={config} setConfig={setConfig} />

          <div className="mt-4 border-t pt-3">
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Sets ({sets.length})</h4>
            {!sets.length ? (
              <p className="text-xs text-muted-foreground">Select items in the preview, then “Group as set” for a spanning price banner.</p>
            ) : (
              <div className="space-y-2">
                {sets.map((s, i) => (
                  <div key={s.id} className="rounded-lg border p-2">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-[12px] font-semibold">Set {i + 1} · {s.memberKeys.length} cards{s.quantity > 1 ? ` · ×${s.quantity}` : ''}</span>
                      <button onClick={() => ungroup(s.id)} className="text-muted-foreground hover:text-destructive" aria-label="Ungroup"><X className="size-3.5" /></button>
                    </div>
                    <Input value={s.label ?? ''} onChange={(e) => updateSetLabel(s.id, e.target.value)} placeholder="Label (optional)" className="mb-1.5 h-8" />
                    <div className="flex items-center gap-2">
                      <Input value={s.price} onChange={(e) => updateSetPrice(s.id, Number(e.target.value))} type="number" className="h-8" title="Set price" />
                      <div className="flex items-center gap-1 whitespace-nowrap text-[11px] text-muted-foreground">×<Input value={s.quantity} onChange={(e) => updateSetQty(s.id, Number(e.target.value))} type="number" className="h-8 w-14" title="Quantity of this set" /></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
