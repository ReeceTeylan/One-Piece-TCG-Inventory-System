/**
 * TCGCSV (https://tcgcsv.com) — a free daily mirror of TCGplayer's catalogue
 * and prices. Usage guidelines: identifiable User-Agent, a short pause between
 * requests, pull once per day from a server (never from the browser).
 */
const BASE = 'https://tcgcsv.com/tcgplayer';
export const ONE_PIECE_CATEGORY = 68;

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}/${path}`, {
    headers: { 'User-Agent': "OP-Vault/1.0 (RB's TCG inventory; daily price check)", Accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`TCGCSV responded ${res.status}`);
  return res.json() as Promise<T>;
}

export interface TcgcsvGroup { groupId: number; name: string; abbreviation: string | null }
export interface TcgcsvProduct {
  productId: number; name: string; url: string; imageUrl?: string | null;
  extendedData?: { name: string; value: string }[];
}
export interface TcgcsvPrice {
  productId: number; subTypeName: string;
  lowPrice: number | null; midPrice: number | null; marketPrice: number | null;
}

export const fetchGroups = () =>
  getJson<{ results: TcgcsvGroup[] }>(`${ONE_PIECE_CATEGORY}/groups`).then((r) => r.results ?? []);
export const fetchProducts = (groupId: number) =>
  getJson<{ results: TcgcsvProduct[] }>(`${ONE_PIECE_CATEGORY}/${groupId}/products`).then((r) => r.results ?? []);
export const fetchPrices = (groupId: number) =>
  getJson<{ results: TcgcsvPrice[] }>(`${ONE_PIECE_CATEGORY}/${groupId}/prices`).then((r) => r.results ?? []);
