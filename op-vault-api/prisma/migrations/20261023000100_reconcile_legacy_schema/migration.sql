-- Reconcile legacy Prisma schema changes that were deployed via db push,
-- but were never recorded in the checked-in migrations.
-- All operations are additive or relax obsolete NOT NULL constraints.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProductKind') THEN
    CREATE TYPE "ProductKind" AS ENUM ('SLAB','SEALED');
  END IF;
END $$;
-- Historical enum was MARIBANK; the current application uses BANK_TRANSFER.
-- Rename in place to preserve existing payment history.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid=t.oid
             WHERE t.typname='PaymentMethod' AND e.enumlabel='MARIBANK') THEN
    IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid=t.oid
               WHERE t.typname='PaymentMethod' AND e.enumlabel='BANK_TRANSFER') THEN
      RAISE EXCEPTION 'Both MARIBANK and BANK_TRANSFER enum values exist; manually review historic payments';
    END IF;
    ALTER TYPE "PaymentMethod" RENAME VALUE 'MARIBANK' TO 'BANK_TRANSFER';
  END IF;
END $$;
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'MAYA' BEFORE 'OTHER';

ALTER TABLE "raw_cards" ADD COLUMN IF NOT EXISTS "marketListingKey" TEXT;
ALTER TABLE "restock_logs" ADD COLUMN IF NOT EXISTS "slabId" TEXT;
ALTER TABLE "restock_logs" ALTER COLUMN "rawCardId" DROP NOT NULL;

ALTER TABLE "slab_cards"
  ADD COLUMN IF NOT EXISTS "avgSellPrice" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "kind" "ProductKind" NOT NULL DEFAULT 'SLAB',
  ADD COLUMN IF NOT EXISTS "marketListingKey" TEXT,
  ADD COLUMN IF NOT EXISTS "quantity" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "totalSold" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "slab_cards"
  ALTER COLUMN "gradingCompany" DROP NOT NULL,
  ALTER COLUMN "slabNumber" DROP NOT NULL,
  ALTER COLUMN "grade" DROP NOT NULL;

CREATE TABLE IF NOT EXISTS "promos" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "percentage" DECIMAL(5,2) NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "endedAt" TIMESTAMP(3),
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "market_prices" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "source" TEXT NOT NULL DEFAULT 'YUYUTEI',
  "listingKey" TEXT NOT NULL,
  "cardNumber" TEXT NOT NULL,
  "rarity" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "priceJpy" INTEGER NOT NULL,
  "prevPriceJpy" INTEGER,
  "priceChangedAt" TIMESTAMP(3),
  "inStock" BOOLEAN NOT NULL,
  "stockCount" INTEGER,
  "imageUrl" TEXT,
  "url" TEXT NOT NULL,
  "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "tcgplayer_prices" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "listingKey" TEXT NOT NULL,
  "productId" INTEGER NOT NULL,
  "subTypeName" TEXT NOT NULL,
  "cardNumber" TEXT NOT NULL,
  "rarity" TEXT,
  "name" TEXT NOT NULL,
  "groupId" INTEGER NOT NULL,
  "groupAbbr" TEXT,
  "priceUsd" DECIMAL(10,2) NOT NULL,
  "prevPriceUsd" DECIMAL(10,2),
  "priceChangedAt" TIMESTAMP(3),
  "url" TEXT NOT NULL,
  "imageUrl" TEXT,
  "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "promos_endsAt_idx" ON "promos"("endsAt");
CREATE UNIQUE INDEX IF NOT EXISTS "market_prices_listingKey_key" ON "market_prices"("listingKey");
CREATE INDEX IF NOT EXISTS "market_prices_cardNumber_idx" ON "market_prices"("cardNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "tcgplayer_prices_listingKey_key" ON "tcgplayer_prices"("listingKey");
CREATE INDEX IF NOT EXISTS "tcgplayer_prices_cardNumber_idx" ON "tcgplayer_prices"("cardNumber");
CREATE INDEX IF NOT EXISTS "restock_logs_slabId_idx" ON "restock_logs"("slabId");
CREATE INDEX IF NOT EXISTS "slab_cards_kind_idx" ON "slab_cards"("kind");
CREATE INDEX IF NOT EXISTS "slab_cards_quantity_idx" ON "slab_cards"("quantity");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'restock_logs_slabId_fkey') THEN
    ALTER TABLE "restock_logs"
      ADD CONSTRAINT "restock_logs_slabId_fkey"
      FOREIGN KEY ("slabId") REFERENCES "slab_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
