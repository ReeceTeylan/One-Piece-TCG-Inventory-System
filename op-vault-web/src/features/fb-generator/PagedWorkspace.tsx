import { useState } from 'react';
import { GeneratorWorkspace } from './GeneratorWorkspace';
import { usePagedGenerator } from './usePagedGenerator';
import { useBatchFill } from './use-batch-fill';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Download, Plus, Trash2, Zap } from 'lucide-react';
import { toPng } from 'html-to-image';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { GenMode } from './types';

export function PagedWorkspace({ mode }: { mode: GenMode }) {
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
    <div className="flex flex-col gap-4">
      {/* Multi-Page Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-card p-3 shadow-sm">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCurrent(pages[Math.max(0, currentIndex - 1)]?.id)} disabled={currentIndex === 0 || isExporting}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-[5rem] text-center text-sm font-semibold">
            Page {currentIndex + 1} / {pages.length}
          </span>
          <Button variant="outline" size="sm" onClick={() => setCurrent(pages[Math.min(pages.length - 1, currentIndex + 1)]?.id)} disabled={currentIndex === pages.length - 1 || isExporting}>
            <ChevronRight className="size-4" />
          </Button>
          
          <div className="mx-2 h-4 w-px bg-border" />
          
          <Button variant="ghost" size="sm" onClick={addPage} disabled={isExporting}>
            <Plus className="mr-1 size-4" /> Add Page
          </Button>
          <Button variant="ghost" size="sm" onClick={() => removePage(currentPageId)} disabled={pages.length === 1 || isExporting} className="text-destructive hover:bg-destructive/10 hover:text-destructive">
            <Trash2 className="mr-1 size-4" /> Remove
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <span className="mr-2 text-xs text-muted-foreground">{totalCards} total items</span>
          <Button variant="outline" size="sm" onClick={handleAutoFill} disabled={loading || isExporting}>
            <Zap className="mr-1 size-4" /> {loading ? 'Fetching...' : 'Auto-fill'}
          </Button>
          <Button size="sm" onClick={exportAll} disabled={isExporting || totalCards === 0}>
            <Download className="mr-1 size-4" /> {isExporting ? 'Exporting Batch...' : 'Export All (ZIP)'}
          </Button>
        </div>
      </div>

      {/* The Controlled Workspace */}
      <div className={isExporting ? 'pointer-events-none opacity-60 transition-opacity' : ''}>
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