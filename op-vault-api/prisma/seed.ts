import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Seed is invoked on Render for EVERY deployment.
  // Do not create predictable demo credentials in a public production service.
  if (process.env.OPVAULT_ALLOW_DEMO_SEED === 'true' && process.env.NODE_ENV !== 'production' && !process.env.RENDER) {
    const ownerPass = process.env.OPVAULT_DEMO_OWNER_PASSWORD;
    const staffPass = process.env.OPVAULT_DEMO_STAFF_PASSWORD;
    if (!ownerPass || !staffPass || ownerPass.length < 12 || staffPass.length < 12) {
      throw new Error('Demo seed requires explicit private passwords (12+ characters).');
    }
    await prisma.user.upsert({
      where: { email: 'owner@opvault.ph' }, update: {},
      create: { email: 'owner@opvault.ph', password: await bcrypt.hash(ownerPass, 12),
        fullName: 'Store Owner', role: Role.OWNER },
    });
    await prisma.user.upsert({
      where: { email: 'staff@opvault.ph' }, update: {},
      create: { email: 'staff@opvault.ph', password: await bcrypt.hash(staffPass, 12),
        fullName: 'Store Staff', role: Role.STAFF },
    });
  }
  // Preserve owner-modified configuration; defaults apply only when missing.
  const settings: Record<string, any> = {
    storeName: process.env.STORE_NAME ?? 'OP-Vault TCG',
    currency: process.env.CURRENCY ?? 'PHP',
    lowStockThreshold: Number(process.env.LOW_STOCK_THRESHOLD ?? 3),
    defaultShippingFee: Number(process.env.DEFAULT_SHIPPING_FEE ?? 80),
    postedPriceFormula: 'cost * 2.4',
    logoUrl: null,
  };
  for (const [key, value] of Object.entries(settings)) {
    await prisma.setting.upsert({ where: { key }, update: {}, create: { key, value } });
  }
  console.log('Seed completed without changing existing users or settings.');
}
main().catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
