/**
 * One-off: rebuild every thumbnail from its main image at the 63x88 card ratio.
 * Existing thumbs were square-cropped (fit: 'cover', 300x300), which cut the
 * sides off the card art.
 *
 *   npx ts-node scripts/regen-thumbs.ts
 */
import 'dotenv/config';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;
const BUCKET = process.env.SUPABASE_BUCKET ?? 'card-images';
const FOLDER = 'cards';
const CACHE = '31536000, immutable';
const CONCURRENCY = 4;

if (!URL || !KEY) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env');
  process.exit(1);
}

const client = createClient(URL, KEY, { auth: { persistSession: false } });

async function listMainImages(): Promise<string[]> {
  const out: string[] = [];
  const PAGE = 1000;
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await client.storage
      .from(BUCKET)
      .list(FOLDER, { limit: PAGE, offset });
    if (error) throw error;
    const page = (data ?? []).filter((i) => i.id);
    // Skip the thumbnails themselves — we regenerate them from the mains.
    out.push(
      ...page
        .filter((i) => !i.name.endsWith('_thumb.webp'))
        .map((i) => `${FOLDER}/${i.name}`),
    );
    if (page.length < PAGE) break;
  }
  return out;
}

async function regen(mainKey: string) {
  const { data, error } = await client.storage.from(BUCKET).download(mainKey);
  if (error) throw error;
  const buf = Buffer.from(await data.arrayBuffer());

  const thumb = await sharp(buf)
    .resize(300, 420, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 75 })
    .toBuffer();

  const thumbKey = mainKey.replace(/\.webp$/i, '_thumb.webp');
  const { error: upErr } = await client.storage
    .from(BUCKET)
    .upload(thumbKey, thumb, { contentType: 'image/webp', upsert: true, cacheControl: CACHE });
  if (upErr) throw upErr;
}

async function main() {
  const keys = await listMainImages();
  console.log(`Found ${keys.length} main images in ${BUCKET}/${FOLDER}`);

  let done = 0;
  const failures: { key: string; reason: string }[] = [];

  for (let i = 0; i < keys.length; i += CONCURRENCY) {
    await Promise.all(
      keys.slice(i, i + CONCURRENCY).map(async (key) => {
        try {
          await regen(key);
        } catch (e: any) {
          failures.push({ key, reason: e?.message ?? 'unknown' });
        } finally {
          done++;
        }
      }),
    );
    console.log(`  ${done}/${keys.length}`);
  }

  console.log(`\nDone. ${done - failures.length} regenerated, ${failures.length} failed.`);
  for (const f of failures) console.log(`  FAIL ${f.key}: ${f.reason}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});