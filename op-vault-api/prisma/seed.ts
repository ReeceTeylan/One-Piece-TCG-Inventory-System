import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // --- Owner + Staff users ---
  const ownerPass = await bcrypt.hash('Owner@123', 10);
  const staffPass = await bcrypt.hash('Staff@123', 10);

  await prisma.user.upsert({
    where: { email: 'owner@opvault.ph' },
    update: {},
    create: { email: 'owner@opvault.ph', password: ownerPass, fullName: 'Store Owner', role: Role.OWNER },
  });
  await prisma.user.upsert({
    where: { email: 'staff@opvault.ph' },
    update: {},
    create: { email: 'staff@opvault.ph', password: staffPass, fullName: 'Store Staff', role: Role.STAFF },
  });

  // --- Settings ---
  const settings: Record<string, any> = {
    storeName: process.env.STORE_NAME ?? 'OP-Vault TCG',
    currency: process.env.CURRENCY ?? 'PHP',
    lowStockThreshold: Number(process.env.LOW_STOCK_THRESHOLD ?? 3),
    defaultShippingFee: Number(process.env.DEFAULT_SHIPPING_FEE ?? 80),
    postedPriceFormula: 'cost * 2.4',
    logoUrl: null,
  };
  for (const [key, value] of Object.entries(settings)) {
    await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
  }

  // --- Sample raw cards (mirrors prototype demo data) ---
  const raw = [
    { name: 'Monkey D. Luffy', cardNumber: 'OP01-024', setName: 'Romance Dawn', character: 'Luffy', color: 'Red', rarity: 'SR', quantity: 8, buyCost: 180, postedPrice: 450 },
    { name: 'Roronoa Zoro', cardNumber: 'OP01-025', setName: 'Romance Dawn', character: 'Zoro', color: 'Green', rarity: 'SR', quantity: 3, buyCost: 150, postedPrice: 390 },
    { name: 'Nami', cardNumber: 'OP01-016', setName: 'Romance Dawn', character: 'Nami', color: 'Blue', rarity: 'R', quantity: 24, buyCost: 35, postedPrice: 90 },
    { name: 'Trafalgar Law', cardNumber: 'OP02-069', setName: 'Paramount War', character: 'Law', color: 'Green', rarity: 'SEC', quantity: 1, buyCost: 900, postedPrice: 2200 },
  ];
  for (const r of raw) {
    await prisma.rawCard.upsert({
      where: { rawCardIdentity: { cardNumber: r.cardNumber, setName: r.setName, rarity: r.rarity } },
      update: {},
      create: { ...r, status: r.quantity === 0 ? 'OUT' : r.quantity <= 3 ? 'LOW' : 'AVAILABLE' },
    });
  }

  // --- Sample slab ---
  await prisma.slabCard.upsert({
    where: { slabNumber: '92847561' },
    update: {},
    create: {
      name: 'Monkey D. Luffy (Alt Art)', cardNumber: 'OP05-119', setName: 'Awakening', character: 'Luffy',
      rarity: 'SEC', gradingCompany: 'PSA', slabNumber: '92847561', grade: 10, buyCost: 8500, sellPrice: 15000,
    },
  });

  console.log('Seed complete. Login: owner@opvault.ph / Owner@123');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
