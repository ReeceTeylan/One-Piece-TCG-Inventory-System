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

  console.log('Seed complete. Login: owner@opvault.ph / Owner@123');
}

main().catch((e) => { 
  console.error(e); 
  process.exit(1); 
}).finally(() => prisma.$disconnect());