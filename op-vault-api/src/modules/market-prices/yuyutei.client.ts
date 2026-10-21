const SEARCH_URL = 'https://yuyu-tei.jp/sell/opc/s/search';

/** Fetch the Yuyu-tei search page for one card number, e.g. "OP01-120". */
export async function fetchYuyuteiSearch(cardNumber: string): Promise<string> {
  const url = `${SEARCH_URL}?search_word=${encodeURIComponent(cardNumber.trim().toLowerCase())}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': "OP-Vault/1.0 (RB's TCG inventory; daily price check)",
      'Accept': 'text/html',
      'Accept-Language': 'ja,en;q=0.8',
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Yuyu-tei responded ${res.status}`);
  return res.text();
}

/** Fetch one Yuyu-tei card page by its listing ids, e.g. ("prb02", "10217"). */
export async function fetchYuyuteiCardPage(ver: string, cid: string): Promise<string> {
  const url = `https://yuyu-tei.jp/sell/opc/card/${encodeURIComponent(ver)}/${encodeURIComponent(cid)}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': "OP-Vault/1.0 (RB's TCG inventory; daily price check)",
      'Accept': 'text/html',
      'Accept-Language': 'ja,en;q=0.8',
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Yuyu-tei responded ${res.status}`);
  return res.text();
}
