import { useCallback, useMemo, useState } from 'react';
import type { FbCard, FbSet } from './types';

export interface GenPage {
  id: string;
  cards: FbCard[];
  sets: FbSet[];
}

function pageId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `page-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function usePagedGenerator(perPage: number) {
  const [pages, setPages] = useState<GenPage[]>([{ id: pageId(), cards: [], sets: [] }]);
  const [currentId, setCurrentId] = useState<string>(() => '');

  // Ensure there is always a valid current page.
  const currentPageId = currentId && pages.some((p) => p.id === currentId) ? currentId : pages[0]?.id ?? '';
  const currentIndex = Math.max(0, pages.findIndex((p) => p.id === currentPageId));
  const currentPage = pages[currentIndex] ?? pages[0];

  // Split a pre-sorted card list into pages of exactly `perPage`. Replaces existing pages.
  const autoFill = useCallback((allCards: FbCard[]) => {
    const groups = chunk(allCards, perPage);
    const next: GenPage[] = groups.length
      ? groups.map((cards) => ({ id: pageId(), cards, sets: [] }))
      : [{ id: pageId(), cards: [], sets: [] }];
    setPages(next);
    setCurrentId(next[0].id);
  }, [perPage]);

  const addPage = useCallback(() => {
    const p: GenPage = { id: pageId(), cards: [], sets: [] };
    setPages((prev) => [...prev, p]);
    setCurrentId(p.id);
  }, []);

  const removePage = useCallback((id: string) => {
    setPages((prev) => {
      const filtered = prev.filter((p) => p.id !== id);
      return filtered.length ? filtered : [{ id: pageId(), cards: [], sets: [] }];
    });
  }, []);

  // Per-page setters shaped like React state setters, so they can drive the controlled workspace.
  const setCardsFor = useCallback((id: string): React.Dispatch<React.SetStateAction<FbCard[]>> => {
    return (update) =>
      setPages((prev) => prev.map((p) =>
        p.id === id ? { ...p, cards: typeof update === 'function' ? (update as (c: FbCard[]) => FbCard[])(p.cards) : update } : p,
      ));
  }, []);

  const setSetsFor = useCallback((id: string): React.Dispatch<React.SetStateAction<FbSet[]>> => {
    return (update) =>
      setPages((prev) => prev.map((p) =>
        p.id === id ? { ...p, sets: typeof update === 'function' ? (update as (s: FbSet[]) => FbSet[])(p.sets) : update } : p,
      ));
  }, []);

  const totalCards = useMemo(() => pages.reduce((n, p) => n + p.cards.length, 0), [pages]);

  return {
    pages,
    currentPage,
    currentPageId,
    currentIndex,
    totalCards,
    setCurrent: setCurrentId,
    autoFill,
    addPage,
    removePage,
    setCardsFor,
    setSetsFor,
  };
}