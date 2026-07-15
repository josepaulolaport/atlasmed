-- ============================================================
-- Migration 0005: competitor_products, competitor_product_sectors,
--                 product_equivalences
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Competitor products
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS competitor_products (
  id              text        NOT NULL DEFAULT gen_random_uuid()::text,
  code            text,
  name            text        NOT NULL,
  manufacturer    text,
  brand           text,
  is_active       boolean     NOT NULL DEFAULT true,
  legacy_id       integer     UNIQUE,
  created_at      timestamp   NOT NULL DEFAULT now(),
  updated_at      timestamp   NOT NULL DEFAULT now(),

  CONSTRAINT competitor_products_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS competitor_products_is_active_idx    ON competitor_products(is_active);
CREATE INDEX IF NOT EXISTS competitor_products_manufacturer_idx ON competitor_products(manufacturer);

-- ------------------------------------------------------------
-- 2. Sector scope for competitor products (many-to-many)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS competitor_product_sectors (
  id                      text        NOT NULL DEFAULT gen_random_uuid()::text,
  competitor_product_id   text        NOT NULL REFERENCES competitor_products(id) ON DELETE CASCADE,
  sector_id               text        NOT NULL REFERENCES sectors(id)             ON DELETE CASCADE,
  created_at              timestamp   NOT NULL DEFAULT now(),

  CONSTRAINT competitor_product_sectors_pkey   PRIMARY KEY (id),
  CONSTRAINT competitor_product_sectors_unique UNIQUE (competitor_product_id, sector_id)
);

CREATE INDEX IF NOT EXISTS competitor_product_sectors_cp_id_idx     ON competitor_product_sectors(competitor_product_id);
CREATE INDEX IF NOT EXISTS competitor_product_sectors_sector_id_idx ON competitor_product_sectors(sector_id);

-- ------------------------------------------------------------
-- 3. Product equivalences (many-to-many bridge)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_equivalences (
  id                      text        NOT NULL DEFAULT gen_random_uuid()::text,
  product_id              text        NOT NULL REFERENCES products(id)             ON DELETE CASCADE,
  competitor_product_id   text        NOT NULL REFERENCES competitor_products(id)  ON DELETE CASCADE,
  notes                   text,
  created_at              timestamp   NOT NULL DEFAULT now(),

  CONSTRAINT product_equivalences_pkey   PRIMARY KEY (id),
  CONSTRAINT product_equivalences_unique UNIQUE (product_id, competitor_product_id)
);

CREATE INDEX IF NOT EXISTS product_equivalences_product_id_idx ON product_equivalences(product_id);
CREATE INDEX IF NOT EXISTS product_equivalences_cp_id_idx      ON product_equivalences(competitor_product_id);

COMMIT;
