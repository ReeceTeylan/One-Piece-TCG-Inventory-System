import { useEffect } from 'react';
import { useState } from 'react';
import { authService, promosService } from '@/services';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { PageHeader } from '@/components/common/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { apiError } from '@/lib/api';
import { useSettings, useSettingsMutation } from '@/features/settings/use-settings';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isPromoActive, promoTimeLeft, formatTimeLeft } from '@/lib/promo';

export function SettingsPage() {
  const { data, isLoading } = useSettings();
  const save = useSettingsMutation();
  const { register, handleSubmit, reset } = useForm();

  useEffect(() => { if (data) reset(data); }, [data, reset]);

  const submit = async (values: any) => {
    try {
      await save.mutateAsync({
        storeName: values.storeName,
        currency: values.currency,
        defaultShippingFee: Number(values.defaultShippingFee),
        lowStockThreshold: Number(values.lowStockThreshold),
        postedPriceFormula: values.postedPriceFormula,
        logoUrl: values.logoUrl || null,
      });
      toast.success('Settings saved');
    } catch (e) { toast.error(apiError(e).message); }
  };

  return (
    <>
      <PageHeader title="Settings" subtitle="Store configuration" />
      {isLoading ? <Skeleton className="h-64 w-full max-w-2xl" /> : (
        <form onSubmit={handleSubmit(submit)} className="grid max-w-3xl gap-4 md:grid-cols-2">
          <Card className="p-5">
            <h3 className="mb-4 text-sm font-bold">Store</h3>
            <div className="mb-3"><Label>Store name</Label><Input {...register('storeName')} className="mt-1" /></div>
            <div className="mb-3"><Label>Store logo URL</Label><Input {...register('logoUrl')} className="mt-1" placeholder="/uploads/logo.png" /></div>
            <div><Label>Currency</Label><Input {...register('currency')} className="mt-1" /></div>
          </Card>
          <Card className="p-5">
            <h3 className="mb-4 text-sm font-bold">Selling defaults</h3>
            <div className="mb-3"><Label>Low-stock threshold</Label><Input type="number" {...register('lowStockThreshold')} className="mt-1" /></div>
            <div className="mb-3"><Label>Default shipping fee (₱)</Label><Input type="number" {...register('defaultShippingFee')} className="mt-1" /></div>
            <div><Label>Posted-price formula</Label><Input {...register('postedPriceFormula')} className="mt-1" /></div>
          </Card>
          <div className="md:col-span-2 flex justify-end">
            <Button type="submit" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save changes'}</Button>
          </div>
        </form>
      )}

      <ChangePasswordCard />
      <PromoCard />
    </>
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
    <Card className="mt-4 max-w-md p-5">
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
    <Card className="mt-4 max-w-md p-5">
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
          <p className="mb-3 text-xs text-muted-foreground">Applies to raw cards only. Prices in inventory stay unchanged.</p>
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