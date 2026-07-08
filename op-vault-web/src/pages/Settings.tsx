import { useEffect } from 'react';
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
    </>
  );
}
