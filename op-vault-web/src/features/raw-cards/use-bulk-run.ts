import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiError } from '@/lib/api';

export interface BulkProgress {
  running: boolean;
  done: number;
  total: number;
  failed: number;
}

const IDLE: BulkProgress = { running: false, done: 0, total: 0, failed: 0 };

/**
 * Runs an async action over a list of items sequentially, tracking progress.
 * On completion, invalidates the given query key prefix so the table refreshes.
 *
 * @param invalidateKey  query key prefix to refresh, e.g. ['raw-cards']
 */
export function useBulkRun(invalidateKey: unknown[]) {
  const qc = useQueryClient();
  const [progress, setProgress] = useState<BulkProgress>(IDLE);

  const run = useCallback(
    async <T,>(
      items: T[],
      action: (item: T) => Promise<unknown>,
      opts?: { label?: string },
    ): Promise<{ ok: number; failed: number }> => {
      if (!items.length) return { ok: 0, failed: 0 };
      const label = opts?.label ?? 'items';
      setProgress({ running: true, done: 0, total: items.length, failed: 0 });

      let ok = 0;
      let failed = 0;
      let lastError = '';

      for (const item of items) {
        try {
          await action(item);
          ok += 1;
        } catch (e) {
          failed += 1;
          lastError = apiError(e).message;
        }
        setProgress((p) => ({ ...p, done: p.done + 1, failed }));
      }

      // Refresh the list once, after the whole batch.
      await qc.invalidateQueries({ queryKey: invalidateKey });
      setProgress(IDLE);

      if (failed === 0) {
        toast.success(`Updated ${ok} ${label}.`);
      } else if (ok === 0) {
        toast.error(`Failed on all ${failed} ${label}. ${lastError}`);
      } else {
        toast.warning(`Updated ${ok} ${label}, ${failed} failed. ${lastError}`);
      }

      return { ok, failed };
    },
    [qc, invalidateKey],
  );

  return { run, progress };
}