import { useRef, useState } from 'react';
import Papa from 'papaparse';
import { useQueryClient } from '@tanstack/react-query';
import { Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { rawCardsService } from '@/services';
import { apiError } from '@/lib/api';

const REQUIRED = ['name', 'cardNumber', 'setName', 'rarity', 'quantity', 'buyCost', 'postedPrice'];
type Summary = { total: number; created: number; restocked: number; errors: { row: number; reason: string }[] };

export function ImportCsvDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<any[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);

  const reset = () => { setRows(null); setFileName(''); setParseError(null); setSummary(null); };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    reset();
    setFileName(file.name);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: (res) => {
        const data = res.data as any[];
        if (!data.length) { setParseError('The file has no data rows.'); return; }
        const headers = res.meta.fields ?? [];
        const missing = REQUIRED.filter((c) => !headers.includes(c));
        if (missing.length) { setParseError(`Missing required column(s): ${missing.join(', ')}`); return; }

        const cleaned = data.map((r) => ({
          name: String(r.name ?? '').trim(),
          cardNumber: String(r.cardNumber ?? '').trim(),
          setName: String(r.setName ?? '').trim(),
          rarity: String(r.rarity ?? '').trim(),
          character: r.character ? String(r.character).trim() : undefined,
          color: r.color ? String(r.color).trim() : undefined,
          quantity: Number(r.quantity),
          buyCost: Number(r.buyCost),
          postedPrice: Number(r.postedPrice),
          notes: r.notes ? String(r.notes).trim() : undefined,
        }));

        const bad = cleaned.findIndex((r) =>
          !r.name || !r.cardNumber || !r.setName || !r.rarity ||
          !Number.isFinite(r.quantity) || !Number.isFinite(r.buyCost) || !Number.isFinite(r.postedPrice));
        if (bad !== -1) { setParseError(`Row ${bad + 1} has missing or invalid required values.`); return; }

        setRows(cleaned);
      },
      error: (err) => setParseError(err.message),
    });
  };

  const doImport = async () => {
    if (!rows) return;
    setBusy(true);
    try {
      const res = await rawCardsService.import(rows);
      setSummary(res);
      qc.invalidateQueries({ queryKey: ['raw-cards'] });
      toast.success(`Import done: ${res.created} created, ${res.restocked} restocked`);
    } catch (e) {
      toast.error(apiError(e).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Import raw cards (CSV)</DialogTitle></DialogHeader>

        {!summary ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Upload a CSV to restock. Rows matching an existing <b>card number + set + rarity</b> add to that card's quantity; new combinations are created.
            </p>
            <div className="rounded-lg border bg-muted/40 p-3 text-xs">
              <div className="mb-1 font-semibold">Required columns</div>
              <code className="text-[11px]">name, cardNumber, setName, rarity, quantity, buyCost, postedPrice</code>
              <div className="mt-1 text-muted-foreground">Optional: character, color, notes</div>
            </div>

            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onPick} />
            <Button variant="outline" className="w-full" onClick={() => fileRef.current?.click()}>
              <Upload className="size-4" /> {fileName || 'Choose CSV file'}
            </Button>

            {parseError && <p className="text-sm text-destructive">{parseError}</p>}
            {rows && !parseError && (
              <p className="text-sm text-muted-foreground">{rows.length} row(s) ready to import.</p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
              <Button onClick={doImport} disabled={!rows || !!parseError || busy}>
                {busy ? <><Loader2 className="size-4 animate-spin" /> Importing…</> : 'Import'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg border p-3"><div className="text-2xl font-bold">{summary.created}</div><div className="text-xs text-muted-foreground">Created</div></div>
              <div className="rounded-lg border p-3"><div className="text-2xl font-bold">{summary.restocked}</div><div className="text-xs text-muted-foreground">Restocked</div></div>
              <div className="rounded-lg border p-3"><div className="text-2xl font-bold text-destructive">{summary.errors.length}</div><div className="text-xs text-muted-foreground">Errors</div></div>
            </div>
            {summary.errors.length > 0 && (
              <div className="max-h-40 overflow-y-auto rounded-lg border p-2 text-xs">
                {summary.errors.map((er) => (
                  <div key={er.row} className="border-b py-1 last:border-0"><b>Row {er.row}:</b> {er.reason}</div>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={reset}>Import another</Button>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}