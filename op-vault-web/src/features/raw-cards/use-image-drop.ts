import { useCallback, useState } from 'react';
import { toast } from 'sonner';

interface UseImageDropOpts {
  // Upload a file for a given row id. Should return a promise.
  onUpload: (file: File, id: string) => Promise<unknown>;
  // Whether a given row already has an image (to confirm before replacing).
  hasImage: (id: string) => boolean;
}

export function useImageDrop({ onUpload, hasImage }: UseImageDropOpts) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const onDragOver = useCallback((id: string) => (e: React.DragEvent) => {
    // Only react to file drags (not row/card reordering, text, etc.)
    if (!Array.from(e.dataTransfer.types).includes('Files')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragId(id);
  }, []);

  const onDragLeave = useCallback((id: string) => (e: React.DragEvent) => {
    // Ignore leave events bubbling from children.
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setDragId((cur) => (cur === id ? null : cur));
  }, []);

  const onDrop = useCallback((id: string) => async (e: React.DragEvent) => {
    if (!Array.from(e.dataTransfer.types).includes('Files')) return;
    e.preventDefault();
    setDragId(null);

    const files = Array.from(e.dataTransfer.files);
    if (!files.length) return;
    if (files.length > 1) toast.message('Multiple files dropped — using the first one.');
    const file = files[0];

    if (!file.type.startsWith('image/')) {
      toast.error('Please drop an image file.');
      return;
    }

    // Confirm before replacing an existing photo; silent when none.
    if (hasImage(id)) {
      const ok = window.confirm('This card already has a photo. Replace it with the dropped image?');
      if (!ok) return;
    }

    setBusyId(id);
    try {
      await onUpload(file, id);
      toast.success('Image updated');
    } catch {
      toast.error('Upload failed. Please try again.');
    } finally {
      setBusyId(null);
    }
  }, [hasImage, onUpload]);

  return { dragId, busyId, onDragOver, onDragLeave, onDrop };
}