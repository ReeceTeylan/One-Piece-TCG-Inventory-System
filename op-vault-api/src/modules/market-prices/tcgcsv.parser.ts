import { TcgcsvGroup, TcgcsvPrice, TcgcsvProduct } from './tcgcsv.client';

export interface TcgRow {
  listingKey: string;     // "tcgp:<productId>:<subTypeName>"
  productId: number;
  subTypeName: string;
  cardNumber: string;
  rarity: string | null;
  name: string;
  groupId: number;
  groupAbbr: string | null;
  priceUsd: number;       // TCGplayer Market Price, else mid, else low
  url: string;
  imageUrl: string | null;
}

const ext = (p: TcgcsvProduct, key: string) =>
  p.extendedData?.find((e) => e.name === key)?.value?.trim() || null;

/**
 * Join one group's products and prices into rows for the card numbers we
 * stock. Sealed products have no extendedData "Number" and are skipped.
 */
export function joinGroup(
  group: TcgcsvGroup,
  products: TcgcsvProduct[],
  prices: TcgcsvPrice[],
  wanted: Set<string>,
): TcgRow[] {
  const byId = new Map<number, TcgcsvProduct>();
  for (const p of products) {
    const num = ext(p, 'Number')?.toUpperCase();
    if (num && wanted.has(num)) byId.set(p.productId, p);
  }
  const rows: TcgRow[] = [];
  for (const pr of prices) {
    const p = byId.get(pr.productId);
    const usd = pr.marketPrice ?? pr.midPrice ?? pr.lowPrice;
    if (!p || usd == null || usd <= 0) continue;
    rows.push({
      listingKey: `tcgp:${p.productId}:${pr.subTypeName}`,
      productId: p.productId,
      subTypeName: pr.subTypeName,
      cardNumber: ext(p, 'Number')!.toUpperCase(),
      rarity: ext(p, 'Rarity'),
      name: p.name,
      groupId: group.groupId,
      groupAbbr: group.abbreviation ?? null,
      priceUsd: Math.round(usd * 100) / 100,
      url: p.url,
      imageUrl: p.imageUrl ?? null,
    });
  }
  return rows;
}

/** Does any product in this group carry one of the wanted card numbers? */
export function groupHasWanted(products: TcgcsvProduct[], wanted: Set<string>): boolean {
  return products.some((p) => {
    const num = ext(p, 'Number')?.toUpperCase();
    return !!num && wanted.has(num);
  });
}
