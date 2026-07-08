import { useCallback, useEffect, useRef, useState } from 'react';
import { UploadCloud, X, ImageIcon, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024;

export interface ImageUploaderProps {
  /** URL of an already-saved image (edit mode). */
  existingUrl?: string | null;
  /** Called when a valid file is chosen (or cleared with null). */
  onFileChange: (file: File | null) => void;
  /** Called when the user removes an already-saved image. */
  onRemoveExisting?: () => void;
  /** 0..100 while uploading; undefined when idle. */
  progress?: number;
  uploading?: boolean;
  disabled?: boolean;
  className?: string;
}

export function ImageUploader({
  existingUrl, onFileChange, onRemoveExisting, progress, uploading, disabled, className,
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(existingUrl ?? null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  // Keep preview in sync with a newly selected File (with object-URL cleanup).
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // When the parent swaps the existing image (e.g. after edit refetch) and no local file is picked.
  useEffect(() => {
    if (!file) setPreview(existingUrl ?? null);
  }, [existingUrl, file]);

  const validate = (f: File): string | null => {
    if (!ACCEPTED.includes(f.type)) return 'Use JPG, PNG or WEBP';
    if (f.size > MAX_BYTES) return `Max size is 5 MB (this is ${(f.size / 1024 / 1024).toFixed(1)} MB)`;
    return null;
  };

  const select = useCallback((f: File | null) => {
    setError(null);
    if (!f) { setFile(null); onFileChange(null); return; }
    const err = validate(f);
    if (err) { setError(err); return; }
    setFile(f); onFileChange(f);
  }, [onFileChange]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    if (disabled) return;
    const f = e.dataTransfer.files?.[0];
    if (f) select(f);
  };

  const clearAll = () => {
    setFile(null); setPreview(null); setError(null);
    onFileChange(null);
    if (existingUrl && onRemoveExisting) onRemoveExisting();
    if (inputRef.current) inputRef.current.value = '';
  };

  const replace = () => inputRef.current?.click();

  return (
    <div className={className}>
      <input
        ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only"
        onChange={(e) => select(e.target.files?.[0] ?? null)} disabled={disabled}
        aria-label="Upload card image"
      />

      {preview ? (
        <div className="relative overflow-hidden rounded-lg border bg-muted">
          <div className="flex items-center gap-3 p-2.5">
            <img src={preview} alt="Card preview" className="h-24 w-[68px] rounded border bg-card object-contain" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium">{file?.name ?? 'Current image'}</p>
              {file && <p className="text-[11px] text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>}
              {uploading && typeof progress === 'number' && (
                <div className="mt-2">
                  <div className="h-1.5 w-full overflow-hidden rounded bg-muted-foreground/20">
                    <div className="h-full rounded bg-primary transition-all" style={{ width: `${progress}%` }} />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">Uploading… {progress}%</p>
                </div>
              )}
              <div className="mt-2 flex gap-1.5">
                <button type="button" onClick={replace} disabled={disabled || uploading}
                  className="inline-flex items-center gap-1 rounded-md border bg-card px-2 py-1 text-[11px] font-semibold hover:bg-muted disabled:opacity-50">
                  <RefreshCw className="size-3" /> Replace
                </button>
                <button type="button" onClick={clearAll} disabled={disabled || uploading}
                  className="inline-flex items-center gap-1 rounded-md border bg-card px-2 py-1 text-[11px] font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50">
                  <X className="size-3" /> Remove
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button" onClick={replace} disabled={disabled}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            'flex w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed px-4 py-6 text-center transition-colors',
            dragging ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50',
            disabled && 'opacity-50',
          )}
        >
          <span className="grid size-9 place-items-center rounded-full bg-muted"><UploadCloud className="size-4 text-muted-foreground" /></span>
          <span className="text-[13px] font-semibold">Drop image or click to browse</span>
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground"><ImageIcon className="size-3" /> JPG, PNG, WEBP · max 5 MB</span>
        </button>
      )}

      {error && <p className="mt-1.5 text-xs text-destructive">{error}</p>}
    </div>
  );
}
