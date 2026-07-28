import { useState } from 'react';
import { useImageViewer } from './ImageViewer';
import { ImageOff } from 'lucide-react';
import { cn } from '@/lib/utils';

// Optional override if images must be loaded from an explicit absolute host in production.
// Leave empty (default) to load images SAME-ORIGIN so the dev proxy handles them and no
// cross-origin (CORP/CORS) blocking can occur.
const ASSET_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/api\/?$/, '');

// Backend origin(s) we want to collapse to same-origin in dev so the Vite proxy serves the
// file and the browser never makes a cross-origin request (avoids ERR_BLOCKED_BY_RESPONSE
// .NotSameOrigin from Helmet's Cross-Origin-Resource-Policy).
const API_ORIGIN_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i;

export function resolveImageUrl(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  let url = raw.trim();
  if (!url) return undefined;

  // Leave blob:/data: previews untouched.
  if (/^(blob:|data:)/i.test(url)) return url;

  // 1. ALWAYS strip localhost first, no matter what!
  url = url.replace(API_ORIGIN_RE, '');

  // 2. Attach the live Render server link
  if (ASSET_BASE) {
    if (/^https?:\/\//i.test(url)) return url;
    return `${ASSET_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
  }

  // 3. Fallback (Guarantee a single leading slash)
  return url.startsWith('/') ? url : `/${url}`;
}

// Upload writes both `<id>.webp` and `<id>_thumb.webp`, so the 300x300 version is
// derivable from the stored URL — lists don't need to pull the full-size image.
export function thumbUrl(raw?: string | null): string | undefined {
  const url = resolveImageUrl(raw);
  if (!url || /^(blob:|data:)/i.test(url)) return url;
  return url.replace(/\.webp$/i, '_thumb.webp');
}

// Lazy-loaded thumbnail with graceful fallback for broken/missing images.
export function CardThumb({ url, alt, className, gallery, zoomable = true }: { url?: string | null; alt: string; className?: string; gallery?: string[]; zoomable?: boolean }) {
  const [error, setError] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);
  const { open } = useImageViewer();
  const full = resolveImageUrl(url);
  // Images uploaded before thumbnails existed have no _thumb file — fall back
  // to the full image rather than showing a broken-image icon.
  const src = thumbFailed ? full : thumbUrl(url);
  if (!src || error) {
    return <div className={cn('grid shrink-0 place-items-center rounded border bg-muted text-muted-foreground', className)}><ImageOff className="size-4" /></div>;
  }
  const onOpen = () => {
    if (!zoomable) return;
    const list = (gallery && gallery.length ? gallery : [url!]).map((u) => resolveImageUrl(u)!).filter(Boolean) as string[];
    const idx = Math.max(0, list.indexOf(full!));
    open(list, idx);
  };
  return (
    <img src={src} alt={alt} loading="lazy"
      onError={() => (thumbFailed ? setError(true) : setThumbFailed(true))}
      onClick={zoomable ? onOpen : undefined}
      role={zoomable ? 'button' : undefined} tabIndex={zoomable ? 0 : undefined}
      onKeyDown={zoomable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } } : undefined}
      className={cn('shrink-0 rounded border object-cover', zoomable && 'cursor-zoom-in', className)} />
  );
}
