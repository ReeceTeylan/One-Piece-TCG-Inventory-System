import { forwardRef, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { toPng } from 'html-to-image';
import { Download, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { resolveImageUrl } from '@/components/common/CardImage';

import { useSettings } from '@/features/settings/use-settings';
import { useAuth } from '@/contexts/auth-context';
import { canShareFiles, dataUrlToFile, useShareImages } from '@/lib/share';
import { triggerDownload } from '@/services';
import { pesoF } from '@/lib/utils';
import storeLogo from '@/assets/LOGO.webp';
import type { Sale, SaleItem } from '@/types';

// Stored QR links are full Supabase URLs; only relative (local-disk) ones need resolving.
const qrSrc = (u: string | null) => (u && /^https?:\/\//i.test(u) ? u : resolveImageUrl(u));

type ReceiptSale = Pick<Sale, 'reference' | 'createdAt' | 'subtotal' | 'discount' | 'shippingFee' | 'grandTotal' | 'amountPaid' | 'status'> & {
  items?: Pick<SaleItem, 'id' | 'nameSnapshot' | 'quantity' | 'unitPrice'>[];
  customer?: { name: string } | null;
  payments?: { method: string }[];
};

const METHOD_LABEL: Record<string, string> = {
  CASH: 'Cash', GCASH: 'GCash', MAYA: 'Maya', BANK_TRANSFER: 'Bank transfer', OTHER: 'Other',
};

/** Receipt image for the buyer: items, totals, balance and the GCash / Maya QR. */
export function ReceiptDialog({ sale, paymentMethod, onOpenChange }: {
  sale: ReceiptSale | null; paymentMethod?: string; onOpenChange: (o: boolean) => void;
}) {
  const { isOwner } = useAuth();
  const settings = useSettings().data;
  const ref = useRef<HTMLDivElement>(null);
  const { share, busy, ready, clear } = useShareImages();
  const [saving, setSaving] = useState(false);
  const balance = sale ? Number(sale.grandTotal) - Number(sale.amountPaid) : 0;
  const hasQr = !!(settings?.gcashQrUrl || settings?.mayaQrUrl);
  const [withQr, setWithQr] = useState(true);
  // Default: show the QR only when there's still something to pay.
  useEffect(() => { setWithQr(balance > 0); clear(); }, [sale?.reference]); // eslint-disable-line react-hooks/exhaustive-deps

  // The preview is scaled to fit narrow phones; the export copy stays full size off-screen.
  const box = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ scale: 1, height: 0 });
  useEffect(() => {
    if (!sale) return;
    const measure = () => {
      const scale = Math.min(1, ((box.current?.clientWidth ?? 384) - 24) / 360);
      const height = ref.current?.offsetHeight ?? 0;
      setFit((f) => (f.scale === scale && f.height === height ? f : { scale, height }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (ref.current) ro.observe(ref.current);
    if (box.current) ro.observe(box.current);
    return () => ro.disconnect();
  }, [sale, withQr]);

  const fileName = `Receipt-${sale?.reference ?? 'sale'}.png`;
  const render = async () => {
    const dataUrl = await toPng(ref.current!, { pixelRatio: 3, cacheBust: true, backgroundColor: '#ffffff' });
    return dataUrlToFile(dataUrl, fileName);
  };
  const save = async () => {
    setSaving(true);
    try { triggerDownload(await render(), fileName); toast.success('Receipt saved'); }
    catch { toast.error("Couldn't make the receipt image. Try again."); }
    finally { setSaving(false); }
  };

  const cardProps = sale && {
    sale, balance, method: paymentMethod ?? sale.payments?.[0]?.method,
    qr: withQr ? { gcash: settings?.gcashQrUrl ?? null, maya: settings?.mayaQrUrl ?? null } : null,
    note: settings?.receiptNote ?? null,
  };

  return (
    <Dialog open={!!sale} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-md overflow-y-auto">
        <DialogHeader><DialogTitle>Receipt · {sale?.reference}</DialogTitle></DialogHeader>
        {sale && cardProps && (
          <>
            <div ref={box} className="mb-3 overflow-hidden rounded-lg border bg-muted/40 p-3">
              <div className="mx-auto" style={{ width: 360 * fit.scale, height: fit.height ? fit.height * fit.scale : undefined }}>
                <div style={{ transform: `scale(${fit.scale})`, transformOrigin: 'top left' }}>
                  <ReceiptCard {...cardProps} />
                </div>
              </div>
            </div>
            {createPortal(
              <div aria-hidden className="pointer-events-none fixed left-[-10000px] top-0"><ReceiptCard ref={ref} {...cardProps} /></div>,
              document.body,
            )}
            {hasQr ? (
              <label className="mb-3 flex items-center justify-between gap-3 text-sm">
                <span>Include GCash / Maya QR</span>
                <Switch checked={withQr} onCheckedChange={(v) => { setWithQr(v); clear(); }} />
              </label>
            ) : (
              <p className="mb-3 text-xs text-muted-foreground">
                {isOwner ? <>Add your GCash or Maya QR in <Link to="/settings" className="font-semibold text-primary hover:underline">Settings</Link> to print it here.</> : 'No payment QR has been added yet.'}
              </p>
            )}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={save} disabled={saving || busy}>
                <Download /> {saving ? 'Saving…' : 'Save image'}
              </Button>
              {canShareFiles() && (
                <Button className="flex-1" onClick={() => share(async () => [await render()])} disabled={saving || busy}>
                  <Share2 /> {busy ? 'Preparing…' : ready ? 'Tap to share' : 'Share'}
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Fixed light design so the image looks the same in dark mode. 360px wide, exported at 3×. */
const ReceiptCard = forwardRef<HTMLDivElement, {
  sale: ReceiptSale; balance: number; method?: string;
  qr: { gcash: string | null; maya: string | null } | null; note: string | null;
}>(({ sale, balance, method, qr, note }, ref) => {
  const date = new Date(sale.createdAt).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  const discount = Number(sale.discount);
  const shipping = Number(sale.shippingFee);
  const codes = qr ? ([['GCash', qr.gcash], ['Maya', qr.maya]] as const).filter(([, u]) => !!u) : [];
  const line = 'flex justify-between gap-3 py-[3px]';
  return (
    <div ref={ref} className="w-[360px] shrink-0 overflow-hidden rounded-xl bg-white font-sans text-[13px] text-[#1c1917] shadow-sm">
      <div className="flex items-center gap-3 bg-[#0f172a] px-5 py-4">
        <img src={storeLogo} alt="" className="size-12 rounded-full" />
        <div className="min-w-0">
          <div className="text-[17px] font-extrabold leading-tight text-[#f5c451]">RB&apos;s TCG</div>
          <div className="text-[11px] tracking-wide text-[#cbd5e1]">ORDER RECEIPT</div>
        </div>
        <div className="ml-auto text-right">
          <div className="text-[12px] font-bold text-white">{sale.reference}</div>
          <div className="text-[10.5px] text-[#94a3b8]">{date}</div>
        </div>
      </div>

      <div className="px-5 pb-4 pt-3.5">
        {sale.customer?.name && <div className="mb-2 text-[12px] text-[#57534e]">For <b className="text-[#1c1917]">{sale.customer.name}</b></div>}

        <div className="border-y border-dashed border-[#d6d3d1] py-2">
          {sale.items?.map((it) => (
            <div key={it.id} className="flex items-start justify-between gap-3 py-1">
              <div className="min-w-0">
                <div className="font-semibold leading-snug">{it.nameSnapshot}</div>
                <div className="text-[11.5px] text-[#78716c]">{it.quantity} × {pesoF(it.unitPrice)}</div>
              </div>
              <div className="shrink-0 font-semibold tabular-nums">{pesoF(Number(it.unitPrice) * it.quantity)}</div>
            </div>
          ))}
        </div>

        <div className="pt-2 text-[12.5px]">
          <div className={line}><span className="text-[#57534e]">Subtotal</span><span className="tabular-nums">{pesoF(sale.subtotal)}</span></div>
          {discount > 0 && <div className={line}><span className="text-[#57534e]">Discount</span><span className="tabular-nums">−{pesoF(discount)}</span></div>}
          {shipping > 0 && <div className={line}><span className="text-[#57534e]">Shipping</span><span className="tabular-nums">{pesoF(shipping)}</span></div>}
          <div className="mt-1 flex justify-between gap-3 border-t border-[#e7e5e4] pt-2 text-[16px] font-extrabold">
            <span>Total</span><span className="tabular-nums">{pesoF(sale.grandTotal)}</span>
          </div>
          {Number(sale.amountPaid) > 0 && (
            <div className={line}>
              <span className="text-[#57534e]">Paid{method ? ` · ${METHOD_LABEL[method] ?? method}` : ''}</span>
              <span className="tabular-nums">{pesoF(sale.amountPaid)}</span>
            </div>
          )}
        </div>

        {balance > 0 ? (
          <div className="mt-2.5 flex items-center justify-between rounded-lg bg-[#fef2f2] px-3 py-2 text-[#b91c1c]">
            <span className="text-[12px] font-bold uppercase tracking-wide">Balance due</span>
            <span className="text-[17px] font-extrabold tabular-nums">{pesoF(balance)}</span>
          </div>
        ) : (
          <div className="mt-2.5 rounded-lg bg-[#f0fdf4] px-3 py-2 text-center text-[12px] font-bold uppercase tracking-widest text-[#15803d]">
            Paid in full · Thank you!
          </div>
        )}

        {codes.length > 0 && (
          <div className="mt-3">
            <div className="mb-1.5 text-center text-[11px] font-bold uppercase tracking-wider text-[#57534e]">Scan to pay</div>
            <div className={codes.length > 1 ? 'grid grid-cols-2 gap-2' : 'mx-auto w-[60%]'}>
              {codes.map(([label, url]) => (
                <div key={label} className="rounded-lg border border-[#e7e5e4] p-1.5 text-center">
                  <img src={qrSrc(url)} alt={`${label} QR`} crossOrigin="anonymous" className="aspect-square w-full object-contain" />
                  <div className="mt-1 text-[11px] font-bold" style={{ color: label === 'GCash' ? '#0b63e5' : '#0a7d3b' }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {note && <p className="mt-3 whitespace-pre-line text-center text-[11.5px] text-[#57534e]">{note}</p>}
        <p className="mt-3 text-center text-[10.5px] text-[#a8a29e]">Thank you for buying from RB&apos;s TCG</p>
      </div>
    </div>
  );
});
ReceiptCard.displayName = 'ReceiptCard';
