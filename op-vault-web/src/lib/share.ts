import { useState } from 'react';
import { toast } from 'sonner';
import { triggerDownload } from '@/services';

/** Turn an html-to-image data URL into a File the share sheet accepts. */
export async function dataUrlToFile(dataUrl: string, name: string): Promise<File> {
  const blob = await (await fetch(dataUrl)).blob();
  return new File([blob], name, { type: blob.type || 'image/png' });
}

/** True on phones (and some desktops) where images can go straight to Messenger etc. */
export function canShareFiles(): boolean {
  try {
    return typeof navigator !== 'undefined' && typeof navigator.canShare === 'function'
      && navigator.canShare({ files: [new File([new Blob(['x'], { type: 'image/png' })], 'x.png', { type: 'image/png' })] });
  } catch {
    return false;
  }
}

/**
 * Share images through the phone's share sheet (Messenger, Viber, Photos…).
 * Browsers only allow sharing right after a tap, so when building the image
 * takes too long the files are kept and the next tap shares them instantly.
 * Where sharing isn't supported the images are downloaded instead.
 */
export function useShareImages() {
  const [ready, setReady] = useState<File[] | null>(null);
  const [busy, setBusy] = useState(false);

  const share = async (make: () => Promise<File[]>) => {
    setBusy(true);
    try {
      const files = ready ?? (await make());
      if (!navigator.canShare?.({ files })) {
        files.forEach((f) => triggerDownload(f, f.name));
        toast.success(files.length > 1 ? `${files.length} images saved` : 'Image saved');
        setReady(null);
        return;
      }
      try {
        await navigator.share({ files });
        setReady(null);
      } catch (e: any) {
        if (e?.name === 'AbortError') { setReady(null); return; } // closed the share sheet
        if (e?.name === 'NotAllowedError') { setReady(files); toast('Image ready. Tap Share again to send it.'); return; }
        throw e;
      }
    } catch {
      toast.error("Couldn't share the image. Try Save image instead.");
    } finally {
      setBusy(false);
    }
  };

  return { share, busy, ready: !!ready, clear: () => setReady(null) };
}
