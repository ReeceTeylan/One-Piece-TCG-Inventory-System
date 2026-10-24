-- Expand-first migration: existing cards keep their current identity and stock history.
ALTER TABLE "raw_cards" ADD COLUMN IF NOT EXISTS "variantKey" TEXT NOT NULL DEFAULT 'standard';
DROP INDEX IF EXISTS "raw_cards_cardNumber_setName_rarity_key";
CREATE UNIQUE INDEX IF NOT EXISTS "raw_cards_cardNumber_setName_rarity_variantKey_key"
  ON "raw_cards"("cardNumber", "setName", "rarity", "variantKey");
CREATE INDEX IF NOT EXISTS "raw_cards_marketListingKey_idx" ON "raw_cards"("marketListingKey");
CREATE TABLE IF NOT EXISTS "quick_add_receipts" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "listingKey" TEXT NOT NULL,
  "cardId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "quick_add_receipts_createdAt_idx" ON "quick_add_receipts"("createdAt");
-- Sequence numbers stay unique even when sales are deleted or concurrent requests arrive.
CREATE SEQUENCE IF NOT EXISTS op_vault_sale_reference_seq START WITH 1001;
SELECT setval('op_vault_sale_reference_seq',
  GREATEST(1000, COALESCE((SELECT MAX(SUBSTRING("reference" FROM '^SALE-([0-9]+)$')::bigint) FROM "sales"), 1000)),
  true);

CREATE TABLE IF NOT EXISTS "card_catalog_entries" (
  "cardNumber" TEXT NOT NULL PRIMARY KEY,
  "englishName" TEXT NOT NULL,
  "category" TEXT,
  "colors" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "rarity" TEXT,
  "setName" TEXT,
  "source" TEXT NOT NULL DEFAULT 'manual-import',
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
