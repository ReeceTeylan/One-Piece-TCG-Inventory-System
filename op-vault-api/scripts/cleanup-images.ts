import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';

const LIVE = process.argv.includes('--live');
const prisma = new PrismaClient();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const BUCKET = process.env.SUPABASE_BUCKET ?? 'card-images';

const thumbOf = (key: string) => key.replace('.webp', '_thumb.webp');

async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_KEY in op-vault-api/.env');
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // Newest first, so the first row per owner is the keeper.
  const images = await prisma.cardImage.findMany({ orderBy: { createdAt: 'desc' } });

  const byOwner = new Map<string, typeof images>();
  for (const img of images) {
    const owner = img.rawCardId ? `raw:${img.rawCardId}` : img.slabId ? `slab:${img.slabId}` : null;
    if (!owner) continue;
    if (!byOwner.has(owner)) byOwner.set(owner, []);
    byOwner.get(owner)!.push(img);
  }

  const doomed: { owner: string; id: string; storageKey: string; createdAt: Date }[] = [];
  let affectedOwners = 0;

  for (const [owner, list] of byOwner) {
    if (list.length <= 1) continue;
    affectedOwners++;
    const [, ...rest] = list; // keep list[0] (newest)
    for (const r of rest) {
      doomed.push({ owner, id: r.id, storageKey: r.storageKey, createdAt: r.createdAt });
    }
  }

  console.log('─'.repeat(60));
  console.log(`Mode:              ${LIVE ? '*** LIVE — WILL DELETE ***' : 'DRY RUN (nothing will be deleted)'}`);
  console.log(`Bucket:            ${BUCKET}`);
  console.log(`Total image rows:  ${images.length}`);
  console.log(`Owners (cards):    ${byOwner.size}`);
  console.log(`Cards w/ extras:   ${affectedOwners}`);
  console.log(`Rows to delete:    ${doomed.length}`);
  console.log(`Files to delete:   ${doomed.length * 2}  (main + _thumb)`);
  console.log('─'.repeat(60));

  for (const d of doomed.slice(0, 20)) {
    console.log(`  ${d.owner}  ${d.storageKey}  (${d.createdAt.toISOString()})`);
  }
  if (doomed.length > 20) console.log(`  … and ${doomed.length - 20} more`);

  if (!LIVE) {
    console.log('\nDry run complete. Re-run with --live to actually delete.');
    return;
  }

  let files = 0;
  let rows = 0;
  for (const d of doomed) {
    const { error } = await supabase.storage.from(BUCKET).remove([d.storageKey, thumbOf(d.storageKey)]);
    if (error) {
      console.warn(`  ! storage delete failed for ${d.storageKey}: ${error.message}`);
    } else {
      files += 2;
    }
    await prisma.cardImage.delete({ where: { id: d.id } });
    rows++;
  }

  console.log(`\nDone. Deleted ${rows} rows and ${files} files.`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());