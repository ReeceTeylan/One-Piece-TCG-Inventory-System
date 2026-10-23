import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

/**
 * useState that survives a page refresh: the value is saved in the browser
 * (localStorage, or sessionStorage for "this visit only") under
 * "opv:filter:<key>". Pass `allowed` for dropdowns so a saved value that's no
 * longer an option falls back to the default instead of breaking the filter.
 */
export function useStickyState<T>(
  key: string,
  initial: T,
  opts: { allowed?: readonly T[]; session?: boolean } = {},
): [T, Dispatch<SetStateAction<T>>] {
  const storageKey = `opv:filter:${key}`;
  const store = () => (opts.session ? window.sessionStorage : window.localStorage);
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = store().getItem(storageKey);
      if (raw !== null) {
        const saved = JSON.parse(raw) as T;
        const sameType = typeof saved === typeof initial;
        if (sameType && (!opts.allowed || opts.allowed.includes(saved))) return saved;
      }
    } catch { /* storage blocked or bad value: use the default */ }
    return initial;
  });
  useEffect(() => {
    try { store().setItem(storageKey, JSON.stringify(value)); } catch { /* ignore */ }
  }, [storageKey, value]); // eslint-disable-line react-hooks/exhaustive-deps
  return [value, setValue];
}
