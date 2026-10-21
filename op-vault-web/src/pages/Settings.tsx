import { useState } from 'react';
import { authService, promosService, settingsService } from '@/services';
import { Textarea } from '@/components/ui/textarea';
import { resolveImageUrl } from '@/components/common/CardImage';

import { Upload, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/common/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiError } from '@/lib/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isPromoActive, promoTimeLeft, formatTimeLeft } from '@/lib/promo';
import { useSettings, useSettingsMutation } from '@/features/settings/use-settings';

// Stored QR links are full Supabase URLs; only relative (local-disk) ones need resolving.
const qrSrc = (u: string | null) => (u && /^https?:\/\//i.test(u) ? u : resolveImageUrl(u));

export function SettingsPage() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <PageHeader title="Settings" subtitle="Account & store sale" />
      <div className="grid max-w-4xl gap-4 md:grid-cols-2">
        <ChangePasswordCard />
        <PromoCard />
        <MarketPricesCard />
        <ReceiptSettingsCard />
      </div>
    </div>
  );
}

function ChangePasswordCard() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (next.length < 8) { toast.error('New password must be at least 8 characters'); return; }
    if (next === current) { toast.error('New password must be different from the current one'); return; }
    if (next !== confirm) { toast.error('New password and confirmation do not match'); return; }
    setBusy(true);
    try {
      await authService.changePassword({ currentPassword: current, newPassword: next });
      toast.success('Password changed successfully');
      setCurrent(''); setNext(''); setConfirm('');
    } catch (e) {
      toast.error(apiError(e).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-5">
      <h3 className="mb-4 text-sm font-bold">Change password</h3>
      <div className="mb-3">
        <Label>Current password</Label>
        <Input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className="mt-1" />
      </div>
      <div className="mb-3">
        <Label>New password</Label>
        <Input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className="mt-1" />
        <p className="mt-1 text-xs text-muted-foreground">At least 8 characters, different from your current password.</p>
      </div>
      <div className="mb-4">
        <Label>Confirm new password</Label>
        <Input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="mt-1" />
      </div>
      <div className="flex justify-end">
        <Button onClick={submit} disabled={busy || !current || !next || !confirm}>
          {busy ? 'Updating…' : 'Change password'}
        </Button>
      </div>
    </Card>
  );
}

function PromoCard() {
  const qc = useQueryClient();
  const { data: promo, isLoading } = useQuery({
    queryKey: ['promo-active'],
    queryFn: promosService.active,
    refetchInterval: 60_000,
  });
  const [percentage, setPercentage] = useState('10');
  const [hours, setHours] = useState('24');
  const [busy, setBusy] = useState(false);

  const active = isPromoActive(promo);

  const start = async () => {
    const pct = Number(percentage);
    const hrs = Number(hours);
    if (!(pct > 0 && pct < 100)) { toast.error('Percentage must be between 1 and 99'); return; }
    if (!(hrs >= 0.5)) { toast.error('Duration must be at least 30 minutes'); return; }
    setBusy(true);
    try {
      await promosService.create({ percentage: pct, durationHours: hrs });
      await qc.invalidateQueries({ queryKey: ['promo-active'] });
      toast.success(`${pct}% off started for ${hrs} hour(s)`);
    } catch (e) { toast.error(apiError(e).message); }
    finally { setBusy(false); }
  };

  const end = async () => {
    setBusy(true);
    try {
      await promosService.end();
      await qc.invalidateQueries({ queryKey: ['promo-active'] });
      toast.success('Promo ended');
    } catch (e) { toast.error(apiError(e).message); }
    finally { setBusy(false); }
  };

  return (
    <Card className="p-5">
      <h3 className="mb-4 text-sm font-bold">Store-wide sale</h3>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Checking…</p>
      ) : active ? (
        <>
          <div className="mb-4 rounded-lg border border-success/30 bg-success/5 p-3">
            <div className="text-lg font-bold text-success">{Number(promo!.percentage)}% off raw cards</div>
            <div className="text-xs text-muted-foreground">Ends in {formatTimeLeft(promoTimeLeft(promo))}</div>
          </div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={end} disabled={busy}>{busy ? 'Ending…' : 'End sale now'}</Button>
          </div>
        </>
      ) : (
        <>
          <p className="mb-3 text-xs text-muted-foreground">Applies store-wide — raw cards, slabs, and sealed products. Prices in inventory stay unchanged.</p>
          <div className="mb-3 grid grid-cols-2 gap-3">
            <div><Label>Percent off</Label><Input type="number" min={1} max={99} value={percentage} onChange={(e) => setPercentage(e.target.value)} className="mt-1" /></div>
            <div><Label>Duration (hours)</Label><Input type="number" min={0.5} step={0.5} value={hours} onChange={(e) => setHours(e.target.value)} className="mt-1" /></div>
          </div>
          <div className="flex justify-end">
            <Button onClick={start} disabled={busy}>{busy ? 'Starting…' : 'Start sale'}</Button>
          </div>
        </>
      )}
    </Card>
  );
}

/** Settings for the market price sync (Market Prices page). */
type RateKey = 'jpyToPhpRate' | 'usdToPhpRate' | 'jpyToPhpRateDamaged' | 'usdToPhpRateDamaged';
const RATE_FIELDS: { key: RateKey; label: string; placeholder: string; max: number }[] = [
  { key: 'jpyToPhpRate', label: '₱ per ¥1 (Japanese)', placeholder: 'e.g. 0.38', max: 10 },
  { key: 'usdToPhpRate', label: '₱ per $1 (English)', placeholder: 'e.g. 58', max: 1000 },
  { key: 'jpyToPhpRateDamaged', label: '₱ per ¥1, damaged', placeholder: 'e.g. 0.30', max: 10 },
  { key: 'usdToPhpRateDamaged', label: '₱ per $1, damaged', placeholder: 'e.g. 45', max: 1000 },
];

function MarketPricesCard() {
  const settings = useSettings();
  const save = useSettingsMutation();
  const [edits, setEdits] = useState<Partial<Record<RateKey | 'underpricedPct' | 'priceAlertPct', string>>>({});
  // Show saved values until the owner starts typing.
  const value = (key: RateKey | 'underpricedPct' | 'priceAlertPct') =>
    edits[key] ?? (settings.data?.[key] != null ? String(settings.data[key]) : key === 'underpricedPct' ? '90' : key === 'priceAlertPct' ? '20' : '');

  const submit = async () => {
    const dto: Record<string, number> = {};
    for (const f of RATE_FIELDS) {
      const raw = value(f.key).trim();
      if (!raw) continue; // left blank = not set
      const n = Number(raw);
      if (!(n > 0 && n <= f.max)) { toast.error(`${f.label}: enter a number above 0, e.g. ${f.placeholder.replace('e.g. ', '')}`); return; }
      dto[f.key] = n;
    }
    const p = Number(value('underpricedPct'));
    if (!(p >= 1 && p <= 100)) { toast.error('Underpriced threshold must be between 1 and 100%'); return; }
    dto.underpricedPct = p;
    const a = Number(value('priceAlertPct'));
    if (!(a >= 1 && a <= 100)) { toast.error('Price alert must be between 1 and 100%'); return; }
    dto.priceAlertPct = a;
    try {
      await save.mutateAsync(dto);
      setEdits({});
      toast.success('Market price settings saved');
    } catch (e) { toast.error(apiError(e).message); }
  };

  return (
    <Card className="p-5">
      <h3 className="mb-1 text-sm font-bold">Market prices</h3>
      <p className="mb-3 text-xs text-muted-foreground">
        Japanese cards use Yuyu-tei (yen); cards with English or ENG in their notes use TCGplayer (dollars).
        Cards whose notes mention whites, dents, scratches or issues use the damaged rates.
      </p>
      <div className="mb-3 grid grid-cols-2 gap-3">
        {RATE_FIELDS.map((f) => (
          <div key={f.key}>
            <Label>{f.label}</Label>
            <Input type="number" min={0.01} step="any" placeholder={f.placeholder} value={value(f.key)}
              onChange={(e) => setEdits((d) => ({ ...d, [f.key]: e.target.value }))} className="mt-1" />
          </div>
        ))}
        <div><Label>Flag below (% of market)</Label><Input type="number" min={1} max={100} value={value('underpricedPct')} onChange={(e) => setEdits((d) => ({ ...d, underpricedPct: e.target.value }))} className="mt-1" /></div>
        <div><Label>Alert when a card moves (%)</Label><Input type="number" min={1} max={100} value={value('priceAlertPct')} onChange={(e) => setEdits((d) => ({ ...d, priceAlertPct: e.target.value }))} className="mt-1" /></div>
      </div>
      <div className="flex justify-end">
        <Button onClick={submit} disabled={save.isPending || settings.isLoading}>{save.isPending ? 'Saving…' : 'Save'}</Button>
      </div>
    </Card>
  );
}

/** Sale receipt image: GCash / Maya QR and a short note under the totals. */
function ReceiptSettingsCard() {
  const qc = useQueryClient();
  const settings = useSettings();
  const save = useSettingsMutation();
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState<'gcash' | 'maya' | null>(null);
  const noteValue = note ?? settings.data?.receiptNote ?? '';

  const upload = async (method: 'gcash' | 'maya', file?: File | null) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be 5 MB or smaller'); return; }
    setBusy(method);
    try {
      await settingsService.uploadQr(method, file);
      await qc.invalidateQueries({ queryKey: ['settings'] });
      toast.success(`${method === 'gcash' ? 'GCash' : 'Maya'} QR saved`);
    } catch (e) { toast.error(apiError(e).message); }
    finally { setBusy(null); }
  };
  const remove = async (method: 'gcash' | 'maya') => {
    setBusy(method);
    try {
      await settingsService.removeQr(method);
      await qc.invalidateQueries({ queryKey: ['settings'] });
    } catch (e) { toast.error(apiError(e).message); }
    finally { setBusy(null); }
  };
  const saveNote = async () => {
    try {
      await save.mutateAsync({ receiptNote: noteValue.trim() });
      setNote(null);
      toast.success('Receipt note saved');
    } catch (e) { toast.error(apiError(e).message); }
  };

  const slot = (method: 'gcash' | 'maya', label: string) => {
    const url = method === 'gcash' ? settings.data?.gcashQrUrl : settings.data?.mayaQrUrl;
    return (
      <div className="rounded-lg border p-2.5 text-center">
        <div className="mb-1.5 text-xs font-semibold">{label} QR</div>
        {url
          ? <img src={qrSrc(url)} alt={`${label} QR`} className="mx-auto aspect-square w-full max-w-[140px] rounded object-contain" />
          : <div className="mx-auto grid aspect-square w-full max-w-[140px] place-items-center rounded border border-dashed text-[11px] text-muted-foreground">Not set</div>}
        <div className="mt-2 flex justify-center gap-1">
          <label className={`inline-flex h-7 cursor-pointer items-center gap-1 rounded-md border px-2 text-xs font-medium hover:bg-muted ${busy ? 'pointer-events-none opacity-50' : ''}`}>
            <Upload className="size-3.5" /> {busy === method ? 'Saving…' : url ? 'Replace' : 'Upload'}
            <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
              onChange={(e) => { upload(method, e.target.files?.[0]); e.target.value = ''; }} />
          </label>
          {url && <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive" onClick={() => remove(method)} disabled={!!busy} aria-label={`Remove ${label} QR`}><Trash2 className="size-3.5" /></Button>}
        </div>
      </div>
    );
  };

  return (
    <Card className="p-5">
      <h3 className="mb-1 text-sm font-bold">Sale receipts</h3>
      <p className="mb-3 text-xs text-muted-foreground">
        Shown on the receipt image you send buyers after a sale. Use the screenshot of your QR from the GCash or Maya app.
      </p>
      <div className="mb-3 grid grid-cols-2 gap-3">
        {slot('gcash', 'GCash')}
        {slot('maya', 'Maya')}
      </div>
      <Label>Note on the receipt</Label>
      <Textarea value={noteValue} maxLength={200} placeholder="e.g. GCash 0917 123 4567 · R. B." onChange={(e) => setNote(e.target.value)} className="mt-1" />
      <div className="mt-3 flex justify-end">
        <Button onClick={saveNote} disabled={save.isPending || note === null}>{save.isPending ? 'Saving…' : 'Save note'}</Button>
      </div>
    </Card>
  );
}
