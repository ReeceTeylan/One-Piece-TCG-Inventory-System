-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'STAFF');

-- CreateEnum
CREATE TYPE "ItemType" AS ENUM ('RAW', 'SLAB');

-- CreateEnum
CREATE TYPE "StockStatus" AS ENUM ('AVAILABLE', 'LOW', 'OUT', 'SOLD');

-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('PAID', 'PARTIAL', 'UNPAID', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "ShipStatus" AS ENUM ('TO_PACK', 'READY', 'SHIPPED', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Courier" AS ENUM ('LBC', 'JNT', 'LALAMOVE', 'MEETUP', 'OTHER');

-- CreateEnum
CREATE TYPE "InvAction" AS ENUM ('CREATE', 'RESTOCK', 'SALE', 'CANCEL_SALE', 'ADJUST', 'PRICE_CHANGE');

-- CreateEnum
CREATE TYPE "NotifType" AS ENUM ('LOW_STOCK', 'OUT_OF_STOCK', 'SALE', 'SHIPMENT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'GCASH', 'MARIBANK', 'MAYA', 'OTHER');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'STAFF',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "hashedRefreshToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "facebookName" TEXT,
    "contactNumber" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raw_cards" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cardNumber" TEXT NOT NULL,
    "setName" TEXT NOT NULL,
    "character" TEXT,
    "color" TEXT,
    "rarity" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "buyCost" DECIMAL(12,2) NOT NULL,
    "postedPrice" DECIMAL(12,2) NOT NULL,
    "avgSellPrice" DECIMAL(12,2),
    "status" "StockStatus" NOT NULL DEFAULT 'AVAILABLE',
    "notes" TEXT,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "totalSold" INTEGER NOT NULL DEFAULT 0,
    "lastSoldAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "raw_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slab_cards" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cardNumber" TEXT,
    "setName" TEXT,
    "character" TEXT,
    "color" TEXT,
    "rarity" TEXT,
    "gradingCompany" TEXT NOT NULL,
    "slabNumber" TEXT NOT NULL,
    "grade" DECIMAL(3,1) NOT NULL,
    "buyCost" DECIMAL(12,2) NOT NULL,
    "sellPrice" DECIMAL(12,2) NOT NULL,
    "status" "StockStatus" NOT NULL DEFAULT 'AVAILABLE',
    "notes" TEXT,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "soldAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "slab_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "shippingFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(12,2) NOT NULL,
    "amountPaid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalProfit" DECIMAL(12,2) NOT NULL,
    "status" "SaleStatus" NOT NULL DEFAULT 'UNPAID',
    "notes" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_items" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "itemType" "ItemType" NOT NULL,
    "rawCardId" TEXT,
    "slabId" TEXT,
    "nameSnapshot" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "unitCost" DECIMAL(12,2) NOT NULL,
    "lineProfit" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "sale_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipments" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "courier" "Courier" NOT NULL,
    "status" "ShipStatus" NOT NULL DEFAULT 'TO_PACK',
    "shippingFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalValue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "trackingNumber" TEXT,
    "dateShipped" TIMESTAMP(3),
    "dateDelivered" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_items" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "nameSnapshot" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "shipment_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_logs" (
    "id" TEXT NOT NULL,
    "itemType" "ItemType" NOT NULL,
    "rawCardId" TEXT,
    "slabId" TEXT,
    "action" "InvAction" NOT NULL,
    "quantityDelta" INTEGER NOT NULL DEFAULT 0,
    "quantityAfter" INTEGER,
    "reference" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restock_logs" (
    "id" TEXT NOT NULL,
    "rawCardId" TEXT NOT NULL,
    "quantityAdded" INTEGER NOT NULL,
    "buyCost" DECIMAL(12,2) NOT NULL,
    "datePurchased" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "restock_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_history" (
    "id" TEXT NOT NULL,
    "itemType" "ItemType" NOT NULL,
    "itemId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" DECIMAL(12,2) NOT NULL,
    "newValue" DECIMAL(12,2) NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorites" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemType" "ItemType" NOT NULL,
    "rawCardId" TEXT,
    "slabId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "type" "NotifType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_images" (
    "id" TEXT NOT NULL,
    "itemType" "ItemType" NOT NULL,
    "rawCardId" TEXT,
    "slabId" TEXT,
    "url" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "card_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "note" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_events" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "status" "ShipStatus" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipment_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "customers_name_idx" ON "customers"("name");

-- CreateIndex
CREATE INDEX "raw_cards_status_idx" ON "raw_cards"("status");

-- CreateIndex
CREATE INDEX "raw_cards_quantity_idx" ON "raw_cards"("quantity");

-- CreateIndex
CREATE INDEX "raw_cards_rarity_idx" ON "raw_cards"("rarity");

-- CreateIndex
CREATE INDEX "raw_cards_name_idx" ON "raw_cards"("name");

-- CreateIndex
CREATE UNIQUE INDEX "raw_cards_cardNumber_setName_rarity_key" ON "raw_cards"("cardNumber", "setName", "rarity");

-- CreateIndex
CREATE UNIQUE INDEX "slab_cards_slabNumber_key" ON "slab_cards"("slabNumber");

-- CreateIndex
CREATE INDEX "slab_cards_status_idx" ON "slab_cards"("status");

-- CreateIndex
CREATE INDEX "slab_cards_grade_idx" ON "slab_cards"("grade");

-- CreateIndex
CREATE INDEX "slab_cards_gradingCompany_idx" ON "slab_cards"("gradingCompany");

-- CreateIndex
CREATE INDEX "slab_cards_name_idx" ON "slab_cards"("name");

-- CreateIndex
CREATE UNIQUE INDEX "sales_reference_key" ON "sales"("reference");

-- CreateIndex
CREATE INDEX "sales_createdAt_idx" ON "sales"("createdAt");

-- CreateIndex
CREATE INDEX "sales_customerId_idx" ON "sales"("customerId");

-- CreateIndex
CREATE INDEX "sales_status_idx" ON "sales"("status");

-- CreateIndex
CREATE INDEX "sale_items_saleId_idx" ON "sale_items"("saleId");

-- CreateIndex
CREATE INDEX "sale_items_rawCardId_idx" ON "sale_items"("rawCardId");

-- CreateIndex
CREATE INDEX "sale_items_slabId_idx" ON "sale_items"("slabId");

-- CreateIndex
CREATE UNIQUE INDEX "shipments_saleId_key" ON "shipments"("saleId");

-- CreateIndex
CREATE INDEX "shipments_status_idx" ON "shipments"("status");

-- CreateIndex
CREATE INDEX "shipment_items_shipmentId_idx" ON "shipment_items"("shipmentId");

-- CreateIndex
CREATE INDEX "inventory_logs_itemType_idx" ON "inventory_logs"("itemType");

-- CreateIndex
CREATE INDEX "inventory_logs_rawCardId_idx" ON "inventory_logs"("rawCardId");

-- CreateIndex
CREATE INDEX "inventory_logs_createdAt_idx" ON "inventory_logs"("createdAt");

-- CreateIndex
CREATE INDEX "restock_logs_rawCardId_idx" ON "restock_logs"("rawCardId");

-- CreateIndex
CREATE INDEX "price_history_itemType_itemId_idx" ON "price_history"("itemType", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "favorites_userId_rawCardId_key" ON "favorites"("userId", "rawCardId");

-- CreateIndex
CREATE UNIQUE INDEX "favorites_userId_slabId_key" ON "favorites"("userId", "slabId");

-- CreateIndex
CREATE INDEX "activity_logs_userId_idx" ON "activity_logs"("userId");

-- CreateIndex
CREATE INDEX "activity_logs_createdAt_idx" ON "activity_logs"("createdAt");

-- CreateIndex
CREATE INDEX "activity_logs_entityType_entityId_idx" ON "activity_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");

-- CreateIndex
CREATE INDEX "notifications_isRead_idx" ON "notifications"("isRead");

-- CreateIndex
CREATE INDEX "card_images_rawCardId_idx" ON "card_images"("rawCardId");

-- CreateIndex
CREATE INDEX "card_images_slabId_idx" ON "card_images"("slabId");

-- CreateIndex
CREATE INDEX "payments_saleId_idx" ON "payments"("saleId");

-- CreateIndex
CREATE INDEX "shipment_events_shipmentId_idx" ON "shipment_events"("shipmentId");

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_rawCardId_fkey" FOREIGN KEY ("rawCardId") REFERENCES "raw_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_slabId_fkey" FOREIGN KEY ("slabId") REFERENCES "slab_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_items" ADD CONSTRAINT "shipment_items_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_logs" ADD CONSTRAINT "inventory_logs_rawCardId_fkey" FOREIGN KEY ("rawCardId") REFERENCES "raw_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_logs" ADD CONSTRAINT "inventory_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restock_logs" ADD CONSTRAINT "restock_logs_rawCardId_fkey" FOREIGN KEY ("rawCardId") REFERENCES "raw_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restock_logs" ADD CONSTRAINT "restock_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_rawCardId_fkey" FOREIGN KEY ("rawCardId") REFERENCES "raw_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_slabId_fkey" FOREIGN KEY ("slabId") REFERENCES "slab_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_images" ADD CONSTRAINT "card_images_rawCardId_fkey" FOREIGN KEY ("rawCardId") REFERENCES "raw_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_images" ADD CONSTRAINT "card_images_slabId_fkey" FOREIGN KEY ("slabId") REFERENCES "slab_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_events" ADD CONSTRAINT "shipment_events_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
