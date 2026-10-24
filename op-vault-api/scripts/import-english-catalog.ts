/**
 * Import an English card catalog from an owner-reviewed JSON export.
 * Supports an index map keyed by card ID or an array of card objects.
 * Examples: npm run catalog:import -- ./data/cards_by_id.json
 * No image downloading or external scraping occurs here.
 */
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

type CardRow = { id?: string; name?: string; englishName?: string; category?: string; rarity?: string; pack_id?: string; set?: string; colors?: string[]; color?: string };
const file = process.argv[2];
if (!file) throw Error('Provide a path to a trusted English catalog JSON file.');
const raw = JSON.parse(readFileSync(file, 'utf8'));
const source = Array.isArray(raw) ? raw.map((c: CardRow) => [c.id, c] as const) : Object.entries(raw) as [string, CardRow][];
const cards = new Map<string, { englishName: string; category: string | null; rarity: string | null; colors: string[]; setName: string | null }>();
for (const [key, card] of source) {
  if (!card || typeof card !== 'object') continue;
  const num = String(card.id || key || '').split('_')[0].toUpperCase().trim();
  const name = String(card.englishName || card.name || '').trim();
  if (!/^[A-Z0-9]+-\d{2,3}$/.test(num) || !name || name.length > 160 ||
    /[\u3040-\u30ff\u3400-\u9fff]/u.test(name)) continue;
  const colors = (Array.isArray(card.colors) ? card.colors : card.color ? [card.color] : [])
    .filter(v => typeof v === 'string' && /^[a-zA-Z ]{2,32}$/.test(v));
  const setName = String(card.set || card.pack_id || num.split('-')[0]).slice(0, 100);
  cards.set(num, { englishName: name, category: card.category?.slice(0, 100) || null,
    rarity: card.rarity?.slice(0, 60) || null, colors, setName });
}
const db = new PrismaClient();
async function main() {
  let count = 0;
  // Batches avoid exceeding database timeouts on large, versioned catalogs.
  for (const [cardNumber, data] of cards) {
    await db.cardCatalogEntry.upsert({
      where: { cardNumber }, create: { cardNumber, ...data, source: 'owner-import' },
      update: { ...data, source: 'owner-import' },
    });
    count++;
  }
  console.log(`Imported ${count} English card-number records. Marketplace art identities remain separate.`);
}
main().finally(() => db.$disconnect());
