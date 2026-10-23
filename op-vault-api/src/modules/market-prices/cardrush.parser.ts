import { load } from 'cheerio';

const ORIGIN = 'https://www.cardrush-op.jp';
export const CARDRUSH_PREFIX = 'cardrush:';

export interface CardrushListing {
  listingKey: string;   // "cardrush:<product id>", e.g. "cardrush:170"
  cardNumber: string;   // "OP01-001"
  rarity: string;       // Cardrush label, e.g. "L" or "L/P" (parallel)
  name: string;         // full product name, e.g. "〔PSA10鑑定済〕ロロノア・ゾロ(パラレル/漫画絵)【L/P】{OP01-001}"
  priceJpy: number;
  inStock: boolean;
  stockCount: number | null;
  imageUrl: string | null;
  url: string;
}

/** What a Cardrush product name says about the copy being sold. */
export interface CardrushName {
  condition: string | null;   // "A-", "B", "C" from 〔状態A-〕; null = standard copy
  grade: { company: string; grade: string; issues: boolean } | null; // 〔PSA10鑑定済〕, 〔※状態難/PSA10鑑定済〕
  tags: string[];             // "(パラレル/漫画絵)" → ["パラレル", "漫画絵"]
  rarity: string;             // "L/P"
  cardNumber: string;         // "OP01-001"
  extra: string | null;       // trailing "[デッキ販売]"
}

// 〔prefix〕Name(tag/tag)【rarity】{number} [extra]
const NAME_RE = /^(?:〔([^〕]*)〕)?(.*?)((?:\([^)]*\))*)【([^】]*)】\{([^}]*)\}\s*(?:\[([^\]]*)\])?\s*$/;
const GRADE_RE = /^(※状態難\/)?([A-Z]+)\s*(\d+(?:\.\d)?\+?)鑑定済$/;
const NUMBER_RE = /^[A-Z]{1,4}\d{0,3}-\d{3}$/;

/** Split a Cardrush product name into condition, grading, version tags, rarity and number. */
export function parseCardrushName(full: string): CardrushName | null {
  const m = full.replace(/\s+/g, ' ').trim().match(NAME_RE);
  if (!m) return null;
  const [, prefix, , parens, rarity, number, extra] = m;
  const cardNumber = number.trim().toUpperCase();
  if (!NUMBER_RE.test(cardNumber)) return null; // decks and accessories use "{-}"
  const g = prefix?.match(GRADE_RE);
  const cond = prefix?.match(/^状態(.+)$/);
  return {
    condition: cond ? cond[1] : null,
    grade: g ? { company: g[2], grade: g[3], issues: !!g[1] } : null,
    tags: (parens.match(/\(([^)]*)\)/g) ?? []).flatMap((p) => p.slice(1, -1).split('/')).map((t) => t.trim()).filter(Boolean),
    rarity: rarity.trim(),
    cardNumber,
    extra: extra?.trim() || null,
  };
}

/**
 * Parse a Cardrush One Piece search page
 * (https://www.cardrush-op.jp/product-list?keyword=op01+001).
 *
 * Layout (Oct 2026, verified on the "op01 001" and "op01 003" searches): each
 * product is an `li.list_item_cell` with `div.item_data[data-product-id]`,
 * the name in `span.goods_name` (the matched digits are wrapped in a <b>, so
 * the text is read whole), the price in `span.figure` ("24,800円"), and stock
 * in `p.stock` ("在庫数 14枚") or `p.stock.soldout` ("在庫なし"). Sold-out
 * products keep their last price. Every product is returned (graded, worn and
 * standard copies); matching decides which ones count.
 */
export function parseCardrushSearch(html: string): CardrushListing[] {
  const $ = load(html);
  const out: CardrushListing[] = [];
  $('li.list_item_cell').each((_, el) => {
    const item = $(el).find('div.item_data').first();
    const pid = item.attr('data-product-id')?.trim();
    const name = item.find('span.goods_name').first().text().replace(/\s+/g, ' ').trim();
    const parsed = parseCardrushName(name);
    const price = item.find('span.figure').first().text().match(/([\d,]+)\s*円/);
    const priceJpy = price ? parseInt(price[1].replace(/,/g, ''), 10) : NaN;
    if (!pid || !parsed || !Number.isFinite(priceJpy)) return;

    const stock = item.find('p.stock').first();
    const soldOut = stock.hasClass('soldout');
    const count = stock.text().match(/(\d+)/);
    const img = item.find('img').first().attr('src') ?? null;
    out.push({
      listingKey: `${CARDRUSH_PREFIX}${pid}`,
      cardNumber: parsed.cardNumber,
      rarity: parsed.rarity,
      name,
      priceJpy,
      inStock: !soldOut,
      stockCount: soldOut ? 0 : count ? parseInt(count[1], 10) : null,
      imageUrl: img,
      url: `${ORIGIN}/product/${pid}`,
    });
  });
  return out;
}

const PRODUCT_URL = /^https?:\/\/(?:www\.)?cardrush-op\.jp\/(?:phone\/)?product\/(\d+)\/?(?:[?#].*)?$/i;

/** "https://www.cardrush-op.jp/product/170" → its listing key. */
export function parseCardrushProductUrl(input: string): { pid: string; listingKey: string; url: string } | null {
  const m = input.trim().match(PRODUCT_URL);
  if (!m) return null;
  return { pid: m[1], listingKey: `${CARDRUSH_PREFIX}${m[1]}`, url: `${ORIGIN}/product/${m[1]}` };
}

/** Cardrush's search box matches "op01 001" (as on the verified pages). */
export const cardrushKeyword = (cardNumber: string) => cardNumber.trim().toLowerCase().replace(/-/g, ' ');
