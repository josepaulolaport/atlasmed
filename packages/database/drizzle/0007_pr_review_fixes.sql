-- 1. Add rejected_at to orders (if not already present from migration 0004)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'rejected_at'
  ) THEN
    ALTER TABLE "orders" ADD COLUMN "rejected_at" timestamp;
  END IF;
END $$;--> statement-breakpoint

-- 2. Add legacy_product_id index on order_items (if not already present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'order_items' AND indexname = 'order_items_legacy_product_id_idx'
  ) THEN
    CREATE INDEX "order_items_legacy_product_id_idx" ON "order_items" ("legacy_product_id");
  END IF;
END $$;--> statement-breakpoint

-- 3. Convert any UNIQUE CONSTRAINTs to UNIQUE INDEXes for Drizzle convention
-- product_sectors
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'product_sectors' AND constraint_type = 'UNIQUE'
  ) THEN
    ALTER TABLE "product_sectors" DROP CONSTRAINT IF EXISTS "product_sectors_product_id_sector_id_key";
    CREATE UNIQUE INDEX IF NOT EXISTS "product_sectors_product_sector_uidx" ON "product_sectors" ("product_id", "sector_id");
  END IF;
END $$;--> statement-breakpoint

-- competitor_product_sectors
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'competitor_product_sectors' AND constraint_type = 'UNIQUE'
  ) THEN
    ALTER TABLE "competitor_product_sectors" DROP CONSTRAINT IF EXISTS "competitor_product_sectors_competitor_product_id_sector_id_key";
    CREATE UNIQUE INDEX IF NOT EXISTS "competitor_product_sectors_uidx" ON "competitor_product_sectors" ("competitor_product_id", "sector_id");
  END IF;
END $$;--> statement-breakpoint

-- product_equivalences
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'product_equivalences' AND constraint_type = 'UNIQUE'
  ) THEN
    ALTER TABLE "product_equivalences" DROP CONSTRAINT IF EXISTS "product_equivalences_product_id_competitor_product_id_key";
    CREATE UNIQUE INDEX IF NOT EXISTS "product_equivalences_uidx" ON "product_equivalences" ("product_id", "competitor_product_id");
  END IF;
END $$;
