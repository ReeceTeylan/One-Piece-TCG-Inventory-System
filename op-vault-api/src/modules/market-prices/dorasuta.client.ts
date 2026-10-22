const SEARCH_URL = 'https://dorasuta.jp/onepiece-cardgame/product-list';

/** Fetch the Dorasuta search page for one card number, e.g. "OP08-084". */
export async function fetchDorasutaSearch(cardNumber: string): Promise<string> {
  const url = `${SEARCH_URL}?kw=${encodeURIComponent(cardNumber.trim().toUpperCase())}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': "OP-Vault/1.0 (RB's TCG inventory; daily price check)",
      'Accept': 'text/html',
      'Accept-Language': 'ja,en;q=0.8',
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Dorasuta responded ${res.status}`);
  return res.text();
}
