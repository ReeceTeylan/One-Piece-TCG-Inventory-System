import sharp from 'sharp';

/** Decorative thumbnail URLs remain source-linked. Do not copy or persist artwork. */
const ORIGINS = {
  YUYUTEI: 'https://yuyu-tei.jp',
  CARDRUSH: 'https://www.cardrush-op.jp',
  TCGPLAYER: 'https://tcgplayer-cdn.tcgplayer.com',
} as const;
export type ArtworkSource = keyof typeof ORIGINS;

export function imageUrlForSource(input: string | null | undefined, source: ArtworkSource): string | null {
  if (!input) return null;
  try {
    const url = new URL(input, ORIGINS[source]);
    return url.protocol === 'https:' ? url.href : null;
  } catch { return null; }
}

function approvedImageHost(url: URL, source: ArtworkSource): boolean {
  const host = url.hostname.toLowerCase();
  if (source === 'YUYUTEI') return host === 'yuyu-tei.jp' || host.endsWith('.yuyu-tei.jp');
  if (source === 'CARDRUSH') return host === 'cardrush-op.jp' || host.endsWith('.cardrush-op.jp');
  return host === 'tcgplayer-cdn.tcgplayer.com' || host === 'product-images.tcgplayer.com'
    || host === 'images.tcgplayer.com' || host === 'tcgplayer.com';
}

/** Only read vendor URLs already sourced from the catalog, never a client-provided URL. */
export async function readReferenceImage(imageUrl: string, source: ArtworkSource): Promise<Buffer> {
  const url = new URL(imageUrl);
  if (url.protocol !== 'https:' || !approvedImageHost(url, source)) throw new Error('Unsupported artwork host');
  const res = await fetch(url, {
    redirect: 'error',
    headers: { 'User-Agent': 'OP-Vault/1.0 (card artwork verification)', Accept: 'image/avif,image/webp,image/jpeg,image/png' },
    signal: AbortSignal.timeout(6500),
  });
  if (!res.ok || !(res.headers.get('content-type') ?? '').toLowerCase().startsWith('image/'))
    throw new Error('Reference image not available');
  const sizeLimit = 3 * 1024 * 1024;
  if (Number(res.headers.get('content-length') ?? 0) > sizeLimit) throw new Error('Reference image too large');
  if (!res.body) throw new Error('Empty response');
  const reader = res.body.getReader();
  const chunks: Buffer[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > sizeLimit) throw new Error('Reference image too large');
      chunks.push(Buffer.from(value));
    }
  } finally { await reader.cancel().catch(() => undefined); }
  return Buffer.concat(chunks);
}

/** A lightweight 64-bit difference hash. Only a *hint* for cropped/rotated/photos with glare. */
export async function differenceHash(buf: Buffer): Promise<bigint> {
  const pixels = await sharp(buf, { limitInputPixels: 16000000 })
    .rotate().greyscale().resize(9, 8, { fit: 'fill' }).raw().toBuffer();
  let hash = 0n;
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const i = y * 9 + x;
    hash = (hash << 1n) | BigInt(pixels[i] > pixels[i + 1] ? 1 : 0);
  }
  return hash;
}

export function similarityPercent(a: bigint, b: bigint): number {
  let diff = a ^ b, bits = 0;
  while (diff !== 0n) { bits += Number(diff & 1n); diff >>= 1n; }
  return Math.round((64 - bits) * 1000 / 64) / 10;
}
