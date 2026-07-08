import { useState } from 'react';
import { useImageViewer } from './ImageViewer';
import { ImageOff } from 'lucide-react';
import { cn } from '@/lib/utils';

// Optional override if images must be loaded from an explicit absolute host in production.
// Leave empty (default) to load images SAME-ORIGIN so the dev proxy handles them and no
// cross-origin (CORP/CORS) blocking can occur.
const ASSET_BASE = (import.meta.env.VITE_ASSET_URL ?? '').replace(/\/$/, '');

// Backend origin(s) we want to collapse to same-origin in dev so the Vite proxy serves the
// file and the browser never makes a cross-origin request (avoids ERR_BLOCKED_BY_RESPONSE
// .NotSameOrigin from Helmet's Cross-Origin-Resource-Policy).
const API_ORIGIN_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i;

// Normalize whatever the backend returns into a browser-loadable, same-origin URL.
export function resolveImageUrl(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  let url = raw.trim();
  if (!url) return undefined;

  // Leave blob:/data: previews untouched.
  if (/^(blob:|data:)/i.test(url)) return url;

  // If an explicit asset host is configured, use the URL as-is (absolute) or prefix it.
  if (ASSET_BASE) {
    if (/^https?:\/\//i.test(url)) return url;
    return `${ASSET_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
  }

  // No asset host configured -> force SAME-ORIGIN.
  // Strip a localhost/127.0.0.1[:port] backend origin so "http://localhost:4000/uploads/x.webp"
  // becomes "/uploads/x.webp" and is served through the Vite dev proxy (same origin as the app).
  url = url.replace(API_ORIGIN_RE, '');

  // Guarantee a single leading slash for root-relative paths.
  return url.startsWith('/') ? url : `/${url}`;
}

// Lazy-loaded thumbnail with graceful fallback for broken/missing images.
export function CardThumb({ url, alt, className, gallery, zoomable = true }: { url?: string | null; alt: string; className?: string; gallery?: string[]; zoomable?: boolean }) {
  const [error, setError] = useState(false);
  const { open } = useImageViewer();
  const src = resolveImageUrl(url);
  if (!src || error) {
    return <div className={cn('grid place-items-center rounded border bg-muted text-muted-foreground', className)}><ImageOff className="size-4" /></div>;
  }
  const onOpen = () => {
    if (!zoomable) return;
    const list = (gallery && gallery.length ? gallery : [url!]).map((u) => resolveImageUrl(u)!).filter(Boolean) as string[];
    const idx = Math.max(0, list.indexOf(src));
    open(list, idx);
  };
  return (
    <img src={src} alt={alt} loading="lazy" onError={() => setError(true)}
      onClick={zoomable ? onOpen : undefined}
      role={zoomable ? 'button' : undefined} tabIndex={zoomable ? 0 : undefined}
      onKeyDown={zoomable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } } : undefined}
      className={cn('rounded border object-cover', zoomable && 'cursor-zoom-in', className)} />
  );
}
