import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { OverlayConfig, TextPosition } from './types';

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-1">
      <Label className="cursor-pointer">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
function SliderRow({ label, value, min, max, step, onChange, format }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format?: (v: number) => string;
}) {
  return (
    <div className="py-1.5">
      <div className="mb-1 flex items-center justify-between">
        <Label>{label}</Label>
        <span className="text-xs tabular-nums text-muted-foreground">{format ? format(value) : value}</span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={(v) => onChange(v[0])} />
    </div>
  );
}

export function ControlsPanel({ config, setConfig }: { config: OverlayConfig; setConfig: (c: Partial<OverlayConfig>) => void }) {
  const positions: { value: TextPosition; label: string }[] = [
    { value: 'pill', label: 'Pill' }, { value: 'bottom', label: 'Bottom' }, { value: 'top', label: 'Top' }, { value: 'bottom-split', label: 'Split' },
  ];
  return (
    <div className="space-y-4">
      <div>
        <h4 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">Show</h4>
        <Toggle label="Price" checked={config.showPrice} onChange={(v) => setConfig({ showPrice: v })} />
        <Toggle label="Quantity" checked={config.showQuantity} onChange={(v) => setConfig({ showQuantity: v })} />
        <Toggle label="Card number" checked={config.showCardNumber} onChange={(v) => setConfig({ showCardNumber: v })} />
        <Toggle label="Store logo" checked={config.showLogo} onChange={(v) => setConfig({ showLogo: v })} />
        <Toggle label="Notes" checked={config.showNotes} onChange={(v) => setConfig({ showNotes: v })} />
      </div>

      <div className="border-t pt-3">
        <h4 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">Overlay</h4>
        <div className="mb-2 flex gap-1 rounded-lg border bg-muted p-0.5">
          {(['dark', 'light'] as const).map((t) => (
            <button key={t} onClick={() => setConfig({ theme: t })} className={cn('flex-1 rounded-md py-1.5 text-xs font-semibold capitalize', config.theme === t ? 'bg-card shadow' : 'text-muted-foreground')}>{t}</button>
          ))}
        </div>
        <SliderRow label="Opacity" value={config.opacity} min={0} max={1} step={0.05} onChange={(v) => setConfig({ opacity: v })} format={(v) => `${Math.round(v * 100)}%`} />
        <SliderRow label="Font size" value={config.fontSize} min={10} max={26} step={1} onChange={(v) => setConfig({ fontSize: v })} format={(v) => `${v}px`} />
        <SliderRow label="Border radius" value={config.borderRadius} min={0} max={28} step={1} onChange={(v) => setConfig({ borderRadius: v })} format={(v) => `${v}px`} />
        <Toggle label="Shadow" checked={config.shadow} onChange={(v) => setConfig({ shadow: v })} />
      </div>

      <div className="border-t pt-3">
        <h4 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">Text position</h4>
        <div className="flex gap-1 rounded-lg border bg-muted p-0.5">
          {positions.map((p) => (
            <button key={p.value} onClick={() => setConfig({ textPosition: p.value })} className={cn('flex-1 rounded-md py-1.5 text-xs font-semibold', config.textPosition === p.value ? 'bg-card shadow' : 'text-muted-foreground')}>{p.label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
