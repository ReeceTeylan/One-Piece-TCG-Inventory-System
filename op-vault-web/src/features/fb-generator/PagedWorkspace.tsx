import { useEffect, useRef, useState, type ReactNode } from 'react';
import { GeneratorWorkspace } from './GeneratorWorkspace';
import { usePagedGenerator } from './usePagedGenerator';
import { useBatchFill } from './use-batch-fill';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Download, Plus, Share2, Trash2, Zap, X } from 'lucide-react';
import { canShareFiles, dataUrlToFile, useShareImages } from '@/lib/share';
import { toPng } from 'html-to-image';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { GenMode } from './types';
import { awaitExportPage } from './export-helpers';
import { toast } from 'sonner';

export function PagedWorkspace({ mode, tabs }: { mode: GenMode; tabs?: ReactNode }) {
  const {
    pages, currentPage, currentPageId, currentIndex, totalCards,
    setCurrent, autoFill, addPage, removePage, setCardsFor, setSetsFor
  } = usePagedGenerator(mode.perPage);
  const { fetchAllRawSortedByValue, loading } = useBatchFill();
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);


  const handleAutoFill = async () => {
    const allCards = await fetchAllRawSortedByValue();
    if (allCards) autoFill(allCards);
  };

  // Every page as an image, straight to the phone's share sheet (Messenger etc.).
  const shareAll = useShareImages();
  useEffect(() => { shareAll.clear(); }, [pages]); // eslint-disable-line react-hooks/exhaustive-deps
  const capturePages = async (asZip: boolean): Promise<File[]> => {
    if (abort.current) throw new Error('Another export is in progress');
    const controller = new AbortController();
    abort.current = controller;
    const originalId = currentPageId;
    const nonempty = pages.filter(p => p.cards.length);
    setIsExporting(true);
    setProgress({ done: 0, total: nonempty.length });
    try {
      const files: File[] = [];
      for (let i = 0; i < nonempty.length; i++) {
        const page = nonempty[i];
        if (controller.signal.aborted) throw new DOMException('Export cancelled', 'AbortError');
        setCurrent(page.id);
        const node = await awaitExportPage(page.id, page.cards.length, controller.signal);
        const png = await toPng(node, { quality: 1, pixelRatio: 2, cacheBust: false });
        if (controller.signal.aborted) throw new DOMException('Export cancelled', 'AbortError');
        files.push(await dataUrlToFile(png, `Page_${pages.indexOf(page) + 1}.png`));
        setProgress({ done: i + 1, total: nonempty.length });
      }
      if (asZip && !controller.signal.aborted) {
        const zip = new JSZip();
        for (const file of files) zip.file(file.name, file);
        const content = await zip.generateAsync({ type: 'blob' });
        if (controller.signal.aborted) throw new DOMException('Export cancelled', 'AbortError');
        saveAs(content, `Facebook_Batch_${Date.now()}.zip`);
        toast.success(`Exported ${files.length} pages`);
      }
      return files;
    } catch (e) {
      if ((e as Error).name === 'AbortError') toast('Export cancelled');
      else toast.error((e as Error).message || 'Export failed');
      throw e;
    } finally {
      setCurrent(originalId);
      abort.current = null;
      setIsExporting(false);
    }
  };

  const renderAll = () => capturePages(false);
  const exportAll = async () => {
    try { await capturePages(true); } catch { /* message shown above */ }
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
      {/* Multi-Page Toolbar */}
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-4 rounded-lg border bg-card p-2 shadow-sm max-sm:gap-2 max-sm:p-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2 max-sm:grid max-sm:w-full max-sm:grid-cols-[auto_1fr_auto_auto_auto] max-sm:gap-1.5">
          <Button variant="outline" size="sm" onClick={() => setCurrent(pages[Math.max(0, currentIndex - 1)]?.id)} disabled={currentIndex === 0 || isExporting}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-0 text-center text-sm font-semibold">
            Page {currentIndex + 1} / {pages.length}
          </span>
          <Button variant="outline" size="sm" onClick={() => setCurrent(pages[Math.min(pages.length - 1, currentIndex + 1)]?.id)} disabled={currentIndex === pages.length - 1 || isExporting}>
            <ChevronRight className="size-4" />
          </Button>

          <div className="mx-2 hidden h-4 w-px bg-border sm:block" />

          <Button variant="ghost" size="sm" onClick={addPage} disabled={isExporting}>
            <Plus className="size-4 sm:mr-1" /><span className="max-sm:sr-only sm:not-sr-only">Add</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => removePage(currentPageId)} disabled={pages.length === 1 || isExporting} className="text-destructive hover:bg-destructive/10 hover:text-destructive">
            <Trash2 className="size-4 sm:mr-1" /><span className="max-sm:sr-only sm:not-sr-only">Remove</span>
          </Button>

          {tabs && <><div className="mx-2 hidden h-4 w-px bg-border sm:block" /><div className="max-sm:col-span-5 max-sm:w-full">{tabs}</div></>}
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-2 max-sm:grid max-sm:w-full max-sm:grid-cols-3 max-sm:gap-1.5">
          <span className="mr-2 text-xs text-muted-foreground max-sm:hidden">{totalCards} items</span>
          <Button variant="outline" size="sm" className="max-sm:min-w-0 max-sm:px-1.5 max-sm:text-[11px]" onClick={handleAutoFill} disabled={loading || isExporting}>
            <Zap className="mr-1 size-4" /> {loading ? 'Loading…' : 'Auto-fill'}
          </Button>
          {canShareFiles() && (
            <Button variant="outline" size="sm" className="max-sm:min-w-0 max-sm:px-1.5 max-sm:text-[11px]" onClick={() => shareAll.share(renderAll)} disabled={isExporting || shareAll.busy || totalCards === 0}>
              <Share2 className="mr-1 size-4" /> {shareAll.busy ? 'Preparing…' : shareAll.ready ? 'Tap to share' : 'Share all'}
            </Button>
          )}
          <Button size="sm" className="max-sm:min-w-0 max-sm:px-1.5 max-sm:text-[11px]" onClick={exportAll} disabled={isExporting || totalCards === 0}>
            <Download className="mr-1 size-4" /> {isExporting ? `Export ${progress.done}/${progress.total}` : 'Export ZIP'}
          </Button>
        </div>
      </div>

      {isExporting && <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2" role="status" aria-live="polite">
        <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: progress.total ? `${progress.done / progress.total * 100}%` : '0%' }} />
        </div>
        <span className="whitespace-nowrap text-xs font-semibold">Preparing {progress.done}/{progress.total} pages</span>
        <Button size="sm" variant="outline" className="h-8" onClick={() => abort.current?.abort()}><X className="size-3.5" /> Cancel</Button>
      </div>}
      {/* The Controlled Workspace */}
      <div className={`flex min-h-0 min-w-0 flex-1 flex-col ${isExporting ? 'pointer-events-none opacity-60 transition-opacity' : ''}`}>
        <GeneratorWorkspace
          mode={mode}
          exportPageId={currentPageId}
          cards={currentPage.cards}
          onCardsChange={setCardsFor(currentPageId)}
          sets={currentPage.sets}
          onSetsChange={setSetsFor(currentPageId)}
        />
      </div>
    </div>
  );
}