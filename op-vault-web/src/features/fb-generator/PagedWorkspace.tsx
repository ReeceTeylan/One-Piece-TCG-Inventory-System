import { useEffect, useState, type ReactNode } from 'react';
import { GeneratorWorkspace } from './GeneratorWorkspace';
import { usePagedGenerator } from './usePagedGenerator';
import { useBatchFill } from './use-batch-fill';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Download, Plus, Share2, Trash2, Zap } from 'lucide-react';
import { canShareFiles, dataUrlToFile, useShareImages } from '@/lib/share';
import { toPng } from 'html-to-image';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { GenMode } from './types';

export function PagedWorkspace({ mode, tabs }: { mode: GenMode; tabs?: ReactNode }) {
  const {
    pages, currentPage, currentPageId, currentIndex, totalCards,
    setCurrent, autoFill, addPage, removePage, setCardsFor, setSetsFor
  } = usePagedGenerator(mode.perPage);
  const { fetchAllRawSortedByValue, loading } = useBatchFill();
  const [isExporting, setIsExporting] = useState(false);

  const handleAutoFill = async () => {
    const allCards = await fetchAllRawSortedByValue();
    if (allCards) autoFill(allCards);
  };

  // Every page as an image, straight to the phone's share sheet (Messenger etc.).
  const shareAll = useShareImages();
  useEffect(() => { shareAll.clear(); }, [pages]); // eslint-disable-line react-hooks/exhaustive-deps
  const renderAll = async () => {
    setIsExporting(true);
    const originalId = currentPageId;
    const files: File[] = [];
    try {
      for (let i = 0; i < pages.length; i++) {
        if (!pages[i].cards.length) continue;
        setCurrent(pages[i].id);
        await new Promise((resolve) => setTimeout(resolve, 400));
        const node = document.getElementById('fb-export-node');
        if (node) files.push(await dataUrlToFile(await toPng(node, { quality: 1, pixelRatio: 2 }), `Page_${i + 1}.png`));
      }
      return files;
    } finally {
      setCurrent(originalId);
      setIsExporting(false);
    }
  };

  const exportAll = async () => {
    setIsExporting(true);
    const zip = new JSZip();
    const originalId = currentPageId;
    try {
      for (let i = 0; i < pages.length; i++) {
        setCurrent(pages[i].id);
        // Wait for React to render the new props and the DOM to paint
        await new Promise(resolve => setTimeout(resolve, 400));
        const exportNode = document.getElementById('fb-export-node');
        if (exportNode) {
          const dataUrl = await toPng(exportNode, { quality: 1, pixelRatio: 2 });
          const blob = await (await fetch(dataUrl)).blob();
          zip.file(`Page_${i + 1}.png`, blob);
        }
      }
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `Facebook_Batch_${Date.now()}.zip`);
    } finally {
      // Restore the UI to the page the user was originally on
      setCurrent(originalId);
      setIsExporting(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {/* Multi-Page Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-card p-2 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCurrent(pages[Math.max(0, currentIndex - 1)]?.id)} disabled={currentIndex === 0 || isExporting}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-[5rem] text-center text-sm font-semibold">
            Page {currentIndex + 1} / {pages.length}
          </span>
          <Button variant="outline" size="sm" onClick={() => setCurrent(pages[Math.min(pages.length - 1, currentIndex + 1)]?.id)} disabled={currentIndex === pages.length - 1 || isExporting}>
            <ChevronRight className="size-4" />
          </Button>

          <div className="mx-2 hidden h-4 w-px bg-border sm:block" />

          <Button variant="ghost" size="sm" onClick={addPage} disabled={isExporting}>
            <Plus className="mr-1 size-4" /> Add
          </Button>
          <Button variant="ghost" size="sm" onClick={() => removePage(currentPageId)} disabled={pages.length === 1 || isExporting} className="text-destructive hover:bg-destructive/10 hover:text-destructive">
            <Trash2 className="mr-1 size-4" /> Remove
          </Button>

          {tabs && <><div className="mx-2 hidden h-4 w-px bg-border sm:block" />{tabs}</>}
        </div>

        <div className="flex items-center gap-2">
          <span className="mr-2 text-xs text-muted-foreground">{totalCards} items</span>
          <Button variant="outline" size="sm" onClick={handleAutoFill} disabled={loading || isExporting}>
            <Zap className="mr-1 size-4" /> {loading ? 'Loading…' : 'Auto-fill'}
          </Button>
          {canShareFiles() && (
            <Button variant="outline" size="sm" onClick={() => shareAll.share(renderAll)} disabled={isExporting || shareAll.busy || totalCards === 0}>
              <Share2 className="mr-1 size-4" /> {shareAll.busy ? 'Preparing…' : shareAll.ready ? 'Tap to share' : 'Share all'}
            </Button>
          )}
          <Button size="sm" onClick={exportAll} disabled={isExporting || totalCards === 0}>
            <Download className="mr-1 size-4" /> {isExporting ? 'Exporting…' : 'Export ZIP'}
          </Button>
        </div>
      </div>

      {/* The Controlled Workspace */}
      <div className={`flex min-h-0 flex-1 flex-col ${isExporting ? 'pointer-events-none opacity-60 transition-opacity' : ''}`}>
        <GeneratorWorkspace
          mode={mode}
          cards={currentPage.cards}
          onCardsChange={setCardsFor(currentPageId)}
          sets={currentPage.sets}
          onSetsChange={setSetsFor(currentPageId)}
        />
      </div>
    </div>
  );
}