import { load } from 'cheerio';

export interface YuyuteiListing {
  listingKey: string;   // "<ver>/<cid>", stable per printing, e.g. "op01/10151"
  cardNumber: string;   // "OP01-120"
  rarity: string;       // Yuyu-tei section label, e.g. "P-SEC"
  name: string;         // e.g. "シャンクス(パラレル)"
  priceJpy: number;
  inStock: boolean;
  stockCount: number | null;
  imageUrl: string | null;
  url: string;
}

/**
 * Parse a Yuyu-tei One Piece search results page
 * (https://yuyu-tei.jp/sell/opc/s/search?search_word=op01-120).
 *
 * Layout (Oct 2026): each rarity is a `div.cards-list` whose `h3 > span` holds
 * the label ("SEC", "P-SEC", "L", "P-L"…); each listing is a `div.card-product`
 * with the card number in a bordered span, the name in `h4`, the price in
 * `strong` ("3,980 円"), stock in `label.cart_sell_zaiko` ("在庫 : 5 点" or "×"),
 * and its ids in hidden inputs `cart_ver` / `cart_cid`.
 */
export function parseYuyuteiSearch(html: string): YuyuteiListing[] {
  const $ = load(html);
  const out: YuyuteiListing[] = [];

  $('div.cards-list').each((_, section) => {
    const sec = $(section);
    const rarity = sec.find('h3 > span').first().text().trim();
    const products = sec.find('div.card-product');
    if (!rarity || !products.length) return; // filter panels share the class but hold no products

    products.each((_, el) => {
      const card = $(el);
      const ver = card.find('input.cart_ver').attr('value')?.trim();
      const cid = card.find('input.cart_cid').attr('value')?.trim();
      const cardNumber = card.find('span.border-dark').first().text().trim().toUpperCase();
      const name = card.find('h4').first().text().trim();
      // Last "<digits> 円" in the price block, in case a struck-through old price precedes it.
      const prices = card.find('strong').first().text().match(/[\d,]+(?=\s*円)/g);
      const priceJpy = prices ? parseInt(prices[prices.length - 1].replace(/,/g, ''), 10) : NaN;
      if (!ver || !cid || !cardNumber || !name || !Number.isFinite(priceJpy)) return;

      const stockMatch = card.find('label.cart_sell_zaiko').text().match(/(\d+)/);
      const stockCount = stockMatch ? parseInt(stockMatch[1], 10) : null;
      const img = card.find('img.card').first().attr('src') ?? null;

      out.push({
        listingKey: `${ver}/${cid}`,
        cardNumber,
        rarity,
        name,
        priceJpy,
        inStock: !card.hasClass('sold-out') && (stockCount ?? 0) > 0,
        stockCount,
        imageUrl: img && !img.includes('noimage') ? img : null,
        url: card.find('a[href*="/card/"]').first().attr('href') ?? '',
      });
    });
  });

  return out;
}

const CARD_URL = /^https?:\/\/(?:www\.)?yuyu-tei\.jp\/sell\/opc\/card\/([a-z0-9-]+)\/(\d+)\/?(?:[?#].*)?$/i;

/** "https://yuyu-tei.jp/sell/opc/card/prb02/10217" → its listing key and canonical URL. */
export function parseYuyuteiCardUrl(input: string): { ver: string; cid: string; listingKey: string; url: string } | null {
  const m = input.trim().match(CARD_URL);
  if (!m) return null;
  const ver = m[1].toLowerCase();
  const cid = m[2];
  return { ver, cid, listingKey: `${ver}/${cid}`, url: `https://yuyu-tei.jp/sell/opc/card/${ver}/${cid}` };
}

/**
 * Parse a single Yuyu-tei card page (https://yuyu-tei.jp/sell/opc/card/prb02/10217).
 *
 * Layout (Oct 2026, verified on a DON!! card page): `section#product-detail`
 * holds the card number in a bordered span ("-" for DON!!), the price in
 * `.product-detailing h4` ("3,980 円"), stock in `#cart_sell_zaiko_pc`
 * ("在庫 : 7 点"), ids in `cart_ver` / `cart_cid` inputs, and the heading
 * `#power h3` reads "<rarity> <name>" ("- ドン!!カード(しらほし)…").
 */
export function parseYuyuteiCardPage(html: string): YuyuteiListing | null {
  const $ = load(html);
  const detail = $('#product-detail');
  const ver = detail.find('input.cart_ver').attr('value')?.trim();
  const cid = detail.find('input.cart_cid').attr('value')?.trim();
  const prices = detail.find('.product-detailing h4').first().text().match(/[\d,]+(?=\s*円)/g);
  const priceJpy = prices ? parseInt(prices[prices.length - 1].replace(/,/g, ''), 10) : NaN;
  const heading = $('#power h3').first().text().replace(/\s+/g, ' ').trim();
  if (!ver || !cid || !heading || !Number.isFinite(priceJpy)) return null;

  const space = heading.indexOf(' ');
  const rarity = space > 0 ? heading.slice(0, space) : '';
  const name = space > 0 ? heading.slice(space + 1).trim() : heading;
  const cardNumber = detail.find('.product-detailing span.border-dark').first().text().trim().toUpperCase();
  const stockMatch = detail.find('#cart_sell_zaiko_pc').text().match(/(\d+)/);
  const stockCount = stockMatch ? parseInt(stockMatch[1], 10) : null;
  const img = detail.find('img.vimg').first().attr('src') ?? null;

  return {
    listingKey: `${ver}/${cid}`,
    cardNumber: cardNumber || '-',
    rarity: rarity || '-',
    name,
    priceJpy,
    inStock: (stockCount ?? 0) > 0,
    stockCount,
    imageUrl: img && !img.includes('noimage') ? img : null,
    url: `https://yuyu-tei.jp/sell/opc/card/${ver}/${cid}`,
  };
}
