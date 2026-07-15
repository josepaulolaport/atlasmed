-- ============================================================
-- Migration 0007: PR review fixes
-- - Add rejected_at timestamp to orders
-- - Add index on order_items.legacy_product_id
-- - Fix unique constraint names to match Drizzle schema conventions
--   (rename UNIQUE CONSTRAINTs created in 0004/0005 to UNIQUE INDEXes)
-- ============================================================

-- ------------------------------------------------------------
-- 1. Add rejected_at to orders lifecycle
-- ------------------------------------------------------------
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS rejected_at timestamp;

-- ------------------------------------------------------------
-- 2. Index for legacy_product_id lookups in order_items
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS order_items_legacy_product_id_idx ON order_items(legacy_product_id);

-- ------------------------------------------------------------
-- 3. Fix unique constraint names → unique indexes (product_sectors)
--    Drizzle schema uses uniqueIndex("product_sectors_product_id_sector_id_uidx")
--    but migration 0004 created CONSTRAINT product_sectors_unique.
-- ------------------------------------------------------------
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'product_sectors_unique'
      AND table_name = 'product_sectors'
  ) THEN
    ALTER TABLE product_sectors DROP CONSTRAINT product_sectors_unique;
    CREATE UNIQUE INDEX IF NOT EXISTS product_sectors_product_id_sector_id_uidx
      ON product_sectors(product_id, sector_id);
  END IF;
END $$;

-- ------------------------------------------------------------
-- 4. Fix unique constraint names → unique indexes (competitor_product_sectors)
-- ------------------------------------------------------------
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'competitor_product_sectors_unique'
      AND table_name = 'competitor_product_sectors'
  ) THEN
    ALTER TABLE competitor_product_sectors DROP CONSTRAINT competitor_product_sectors_unique;
    CREATE UNIQUE INDEX IF NOT EXISTS competitor_product_sectors_cp_id_sector_id_uidx
      ON competitor_product_sectors(competitor_product_id, sector_id);
  END IF;
END $$;

-- ------------------------------------------------------------
-- 5. Fix unique constraint names → unique indexes (product_equivalences)
-- ------------------------------------------------------------
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'product_equivalences_unique'
      AND table_name = 'product_equivalences'
  ) THEN
    ALTER TABLE product_equivalences DROP CONSTRAINT product_equivalences_unique;
    CREATE UNIQUE INDEX IF NOT EXISTS product_equivalences_product_id_cp_id_uidx
      ON product_equivalences(product_id, competitor_product_id);
  END IF;
END $$;
