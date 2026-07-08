import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { X, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';

interface ViewerState { images: string[]; index: number; }
interface ViewerApi { open: (images: string[], index?: number) => void; }

const ImageViewerContext = createContext<ViewerApi>({ open: () => {} });
export const useImageViewer = () => useContext(ImageViewerContext);

const MIN = 1, MAX = 6;

export function ImageViewerProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ViewerState | null>(null);
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const dragging = useRef(false);
  const last = useRef({ x: 0, y: 0 });
  const pinch = useRef<{ dist: number; scale: number } | null>(null);

  const open = useCallback((images: string[], index = 0) => {
    if (!images.length) return;
    setState({ images, index });
    setScale(1); setTx(0); setTy(0);
  }, []);
  const close = useCallback(() => setState(null), []);
  const reset = () => { setScale(1); setTx(0); setTy(0); };

  const go = useCallback((dir: number) => {
    setState((s) => {
      if (!s) return s;
      const index = (s.index + dir + s.images.length) % s.images.length;
      return { ...s, index };
    });
    reset();
  }, []);

  const zoom = (delta: number) => {
    setScale((prev) => {
      const next = Math.min(MAX, Math.max(MIN, +(prev + delta).toFixed(2)));
      if (next === 1) { setTx(0); setTy(0); }
      return next;
    });
  };

  // keyboard
  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === '+' || e.key === '=') zoom(0.3);
      else if (e.key === '-') zoom(-0.3);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state, close, go]);

  if (!state) return (
    <ImageViewerContext.Provider value={{ open }}>{children}</ImageViewerContext.Provider>
  );

  const src = state.images[state.index];
  const multi = state.images.length > 1;

  const onWheel = (e: React.WheelEvent) => { e.preventDefault(); zoom(e.deltaY < 0 ? 0.25 : -0.25); };
  const onDown = (e: React.MouseEvent) => { if (scale === 1) return; dragging.current = true; last.current = { x: e.clientX, y: e.clientY }; };
  const onMove = (e: React.MouseEvent) => {
    if (!dragging.current) return;
    setTx((x) => x + (e.clientX - last.current.x));
    setTy((y) => y + (e.clientY - last.current.y));
    last.current = { x: e.clientX, y: e.clientY };
  };
  const onUp = () => { dragging.current = false; };

  // touch: pinch + pan
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const [a, b] = [e.touches[0], e.touches[1]];
      pinch.current = { dist: Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY), scale };
    } else if (e.touches.length === 1 && scale > 1) {
      dragging.current = true; last.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinch.current) {
      const [a, b] = [e.touches[0], e.touches[1]];
      const dist = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
      const next = Math.min(MAX, Math.max(MIN, pinch.current.scale * (dist / pinch.current.dist)));
      setScale(+next.toFixed(2));
    } else if (dragging.current && e.touches.length === 1) {
      setTx((x) => x + (e.touches[0].clientX - last.current.x));
      setTy((y) => y + (e.touches[0].clientY - last.current.y));
      last.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };
  const onTouchEnd = () => { pinch.current = null; dragging.current = false; };

  return (
    <ImageViewerContext.Provider value={{ open }}>
      {children}
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-sm"
        role="dialog" aria-modal="true" aria-label="Image preview"
        onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}
        onWheel={onWheel} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>

        {/* toolbar */}
        <div className="absolute right-3 top-3 z-10 flex gap-1.5">
          <button onClick={() => zoom(0.3)} className="grid size-9 place-items-center rounded-lg bg-white/10 text-white hover:bg-white/20" aria-label="Zoom in"><ZoomIn className="size-4" /></button>
          <button onClick={() => zoom(-0.3)} className="grid size-9 place-items-center rounded-lg bg-white/10 text-white hover:bg-white/20" aria-label="Zoom out"><ZoomOut className="size-4" /></button>
          <button onClick={reset} className="grid size-9 place-items-center rounded-lg bg-white/10 text-white hover:bg-white/20" aria-label="Reset zoom"><RotateCcw className="size-4" /></button>
          <button onClick={close} className="grid size-9 place-items-center rounded-lg bg-white/10 text-white hover:bg-white/20" aria-label="Close preview"><X className="size-4" /></button>
        </div>

        {multi && (
          <>
            <button onClick={() => go(-1)} className="absolute left-3 top-1/2 z-10 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20" aria-label="Previous image"><ChevronLeft /></button>
            <button onClick={() => go(1)} className="absolute right-3 top-1/2 z-10 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20" aria-label="Next image"><ChevronRight /></button>
            <div className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white">{state.index + 1} / {state.images.length}</div>
          </>
        )}

        <img
          src={src} alt="Preview"
          draggable={false}
          onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
          onDoubleClick={() => (scale === 1 ? zoom(1) : reset())}
          className="max-h-[86vh] max-w-[92vw] select-none rounded-lg object-contain shadow-2xl"
          style={{ transform: `translate(${tx}px, ${ty}px) scale(${scale})`, cursor: scale > 1 ? (dragging.current ? 'grabbing' : 'grab') : 'zoom-in', transition: dragging.current ? 'none' : 'transform .12s ease-out' }}
        />
      </div>
    </ImageViewerContext.Provider>
  );
}
