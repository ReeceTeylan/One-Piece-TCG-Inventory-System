/**
 * One-off: re-upload every object in the images bucket so it picks up the
 * long-lived Cache-Control header. Safe to re-run — it only overwrites bytes
 * with themselves.
 *
 *   npx ts-node scripts/backfill-cache.ts
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;
const BUCKET = process.env.SUPABASE_BUCKET ?? 'card-images';
const FOLDER = 'cards';
const CACHE = '31536000, immutable';
const CONCURRENCY = 5;

if (!URL || !KEY) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env');
  process.exit(1);
}

const client = createClient(URL, KEY, { auth: { persistSession: false } });

async function listAll(): Promise<string[]> {
  const out: string[] = [];
  const PAGE = 1000;
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await client.storage
      .from(BUCKET)
      .list(FOLDER, { limit: PAGE, offset });
    if (error) throw error;
    const page = (data ?? []).filter((i) => i.id);
    out.push(...page.map((i) => `${FOLDER}/${i.name}`));
    if (page.length < PAGE) break;
  }
  return out;
}

async function reupload(key: string) {
  const { data, error } = await client.storage.from(BUCKET).download(key);
  if (error) throw error;
  const buf = Buffer.from(await data.arrayBuffer());
  const contentType = data.type || 'image/webp';
  const { error: upErr } = await client.storage
    .from(BUCKET)
    .upload(key, buf, { contentType, upsert: true, cacheControl: CACHE });
  if (upErr) throw upErr;
}

async function main() {
  const keys = await listAll();
  console.log(`Found ${keys.length} objects in ${BUCKET}/${FOLDER}`);

  let done = 0;
  const failures: { key: string; reason: string }[] = [];

  for (let i = 0; i < keys.length; i += CONCURRENCY) {
    const batch = keys.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (key) => {
        try {
          await reupload(key);
        } catch (e: any) {
          failures.push({ key, reason: e?.message ?? 'unknown' });
        } finally {
          done++;
        }
      }),
    );
    console.log(`  ${done}/${keys.length}`);
  }

  console.log(`\nDone. ${done - failures.length} updated, ${failures.length} failed.`);
  for (const f of failures) console.log(`  FAIL ${f.key}: ${f.reason}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});