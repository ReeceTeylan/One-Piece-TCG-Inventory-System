/** Wait until React commits the requested generator page and its images have loaded. */
export async function awaitExportPage(pageId: string, imageCount: number, signal: AbortSignal): Promise<HTMLElement> {
  const started = Date.now();
  while (Date.now() - started < 15000) {
    if (signal.aborted) throw new DOMException('Export cancelled', 'AbortError');
    const node = document.getElementById('fb-export-node');
    if (node && node.dataset.exportPage === pageId && Number(node.dataset.cardCount) === imageCount) {
      const imgs = [...node.querySelectorAll<HTMLImageElement>('img')];
      if (imgs.every(img => img.complete && img.naturalWidth > 0)) {
        // Allow fonts/layout and the canvas to finish painting before capture.
        await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        if (signal.aborted) throw new DOMException('Export cancelled', 'AbortError');
        return node;
      }
      if (imgs.some(img => img.complete && img.naturalWidth === 0)) {
        throw new Error('A card image could not load. Check card images and retry.');
      }
    }
    await new Promise<void>(resolve => setTimeout(resolve, 90));
  }
  throw new Error('Page images did not finish loading. Try again after refreshing.');
}
