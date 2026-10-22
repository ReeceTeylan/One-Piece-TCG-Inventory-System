import { load } from 'cheerio';

const ORIGIN = 'https://dorasuta.jp';
export const DORASUTA_PREFIX = 'dorasuta:';

export interface DorasutaListing {
  listingKey: string;   // "dorasuta:<pid>", e.g. "dorasuta:413585"
  cardNumber: string;   // "OP01-120"
  rarity: string;       // Dorasuta label, e.g. "SEC/パラレル"
  name: string;         // e.g. "シャンクス(OP01-120)"
  priceJpy: number;
  inStock: boolean;
  stockCount: number | null;
  imageUrl: string | null;
  url: string;
}

const NUMBER_IN_NAME = /\(([A-Z]{1,4}\d{0,3}-\d{3})\)/i;
const CODE = /^([A-Z]{1,4})(\d{2})(\d{3})$/i; // "OP08084" → OP08-084

/**
 * Parse a Dorasuta (ドラゴンスター) One Piece search page
 * (https://dorasuta.jp/onepiece-cardgame/product-list?kw=OP08-084).
 *
 * Layout (Oct 2026, verified on the OP01-120 and OP08-084 searches): each copy
 * offered is a `div.element` with
 *   - `div.content > a[href*="product?pid="]` (the product id) and its image
 *     in `img[data-src]`; `p.condition.play` = played copy, `.real_img` = one
 *     specific photographed copy, `.sale` = discounted copy, and
 *     `a.condition.soldout` when none are left;
 *   - `div.description li.change_hight`: name in the link, then a `p` with the
 *     rarity label ("SEC/パラレル") and a `p` with the code ("OP01120");
 *   - the next `li`: the price ("5,000円");
 *   - stock in the quantity select's `data-value`.
 * One product id can appear several times (normal, played, sale copies). Only
 * the normal copy is kept: that's the standard near-mint price.
 */
export function parseDorasutaSearch(html: string): DorasutaListing[] {
  const $ = load(html);
  const byPid = new Map<string, DorasutaListing>();

  $('div.element').each((_, el) => {
    const row = $(el);
    const content = row.children('div.content');
    const desc = row.children('div.description');
    const pid = content.find('a[href*="product?pid="]').first().attr('href')?.match(/pid=(\d+)/)?.[1];
    if (!pid || byPid.has(pid)) return;

    const flags = content.find('p.condition').attr('class') ?? '';
    const head = desc.find('li.change_hight').first();
    const name = head.find('a').first().text().replace(/\s+/g, ' ').trim();
    // Played, single-photo and sale copies aren't the standard price.
    if (/\b(play|real_img|sale)\b/.test(flags) || name.startsWith('【プレイ用】')) return;

    const ps = head.find('p');
    const rarity = ps.eq(0).text().trim();
    const code = ps.eq(1).text().trim();
    const fromName = name.match(NUMBER_IN_NAME)?.[1];
    const fromCode = code.match(CODE);
    const cardNumber = (fromName ?? (fromCode ? `${fromCode[1]}${fromCode[2]}-${fromCode[3]}` : '')).toUpperCase();

    const priceText = desc.find('li').filter((_i, li) => /円/.test($(li).text())).first().text();
    const price = priceText.match(/([\d,]+)\s*円/);
    const priceJpy = price ? parseInt(price[1].replace(/,/g, ''), 10) : NaN;
    if (!name || !rarity || !cardNumber || !Number.isFinite(priceJpy)) return;

    const soldOut = content.find('a.condition.soldout').length > 0;
    const stockAttr = row.find('div.selectbox[id^="selectbox_quantity_"]').first().attr('data-value');
    const stockCount = soldOut ? 0 : stockAttr ? parseInt(stockAttr, 10) : null;
    const img = content.find('img[data-src]').first().attr('data-src') ?? null;

    byPid.set(pid, {
      listingKey: `${DORASUTA_PREFIX}${pid}`,
      cardNumber,
      rarity,
      name,
      priceJpy,
      inStock: !soldOut && (stockCount ?? 1) > 0,
      stockCount,
      imageUrl: img && !img.includes('no_image') ? `${ORIGIN}${img.startsWith('/') ? '' : '/'}${img}` : null,
      url: `${ORIGIN}/onepiece-cardgame/product?pid=${pid}`,
    });
  });

  return [...byPid.values()];
}

const PRODUCT_URL = /^https?:\/\/(?:www\.)?dorasuta\.jp\/onepiece-cardgame\/product\?(?:[^#]*&)?pid=(\d+)/i;
const BUY_URL = /^https?:\/\/buy\.dorasuta\.jp\//i;

/** "https://dorasuta.jp/onepiece-cardgame/product?pid=413585" → its listing key. */
export function parseDorasutaProductUrl(input: string): { pid: string; listingKey: string; url: string } | null {
  const m = input.trim().match(PRODUCT_URL);
  if (!m) return null;
  return { pid: m[1], listingKey: `${DORASUTA_PREFIX}${m[1]}`, url: `${ORIGIN}/onepiece-cardgame/product?pid=${m[1]}` };
}

/** buy.dorasuta.jp shows what Dorasuta pays you, not what it sells for. */
export const isDorasutaBuyUrl = (input: string) => BUY_URL.test(input.trim());
