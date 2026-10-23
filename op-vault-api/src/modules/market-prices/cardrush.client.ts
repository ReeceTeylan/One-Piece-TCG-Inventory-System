import { cardrushKeyword } from './cardrush.parser';

const SEARCH_URL = 'https://www.cardrush-op.jp/product-list';

/** Fetch the Cardrush search page for one card number, e.g. "OP01-001" (searched as "op01 001"). */
export async function fetchCardrushSearch(cardNumber: string): Promise<string> {
  const url = `${SEARCH_URL}?keyword=${encodeURIComponent(cardrushKeyword(cardNumber)).replace(/%20/g, '+')}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': "OP-Vault/1.0 (RB's TCG inventory; daily price check)",
      'Accept': 'text/html',
      'Accept-Language': 'ja,en;q=0.8',
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Cardrush responded ${res.status}`);
  return res.text();
}
