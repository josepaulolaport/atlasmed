-- ============================================================
-- Migration 0004: Products enrichment + product_sectors + orders
-- Source: pedidos_data_extraction/migrations/001 + 002
-- ============================================================

-- ------------------------------------------------------------
-- 1. Drop single-sector FK from products
--    (replaced by many-to-many product_sectors below)
--    Migrate existing sector assignments before dropping the column.
-- ------------------------------------------------------------
INSERT INTO product_sectors (id, product_id, sector_id, created_at)
SELECT gen_random_uuid()::text, id, sector_id, now()
FROM products
WHERE sector_id IS NOT NULL
ON CONFLICT DO NOTHING;

ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_sector_id_fkey,
  DROP COLUMN IF EXISTS sector_id;

-- ------------------------------------------------------------
-- 2. Enrich products with legacy fields from atlasmed.produtos
-- ------------------------------------------------------------
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS legacy_id               integer         UNIQUE,
  ADD COLUMN IF NOT EXISTS description             text,
  ADD COLUMN IF NOT EXISTS barcode                 text,
  ADD COLUMN IF NOT EXISTS commercial_code         text,
  ADD COLUMN IF NOT EXISTS product_group           text,
  ADD COLUMN IF NOT EXISTS product_classification  text,
  ADD COLUMN IF NOT EXISTS brand                   text,
  ADD COLUMN IF NOT EXISTS internal_classification text,
  ADD COLUMN IF NOT EXISTS unit                    text,
  ADD COLUMN IF NOT EXISTS requires_sterilization  boolean         NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS registro_anvisa         text,
  ADD COLUMN IF NOT EXISTS ncm                     text,
  ADD COLUMN IF NOT EXISTS codigo_tiss             text,
  ADD COLUMN IF NOT EXISTS codigo_simpro           text,
  ADD COLUMN IF NOT EXISTS legacy_supplier_id      integer,
  ADD COLUMN IF NOT EXISTS image_url               text,
  ADD COLUMN IF NOT EXISTS legacy_created_at       timestamp;

CREATE INDEX IF NOT EXISTS products_product_group_idx ON products(product_group);

-- ------------------------------------------------------------
-- 3. Seed sectors from legacy Grupo values
--    (run only if sectors table is empty)
-- ------------------------------------------------------------
INSERT INTO sectors (id, slug, name, is_active, created_at, updated_at)
SELECT
  gen_random_uuid()::text, slug, name, true, now(), now()
FROM (VALUES
  ('ortopedia',           'Ortopedia'),
  ('multiespecialidade',  'Multiespecialidade'),
  ('equipamento',         'Equipamento'),
  ('artroscopia',         'Artroscopia'),
  ('viscossuplementacao', 'Viscossuplementação'),
  ('maxilofacial',        'Maxilofacial'),
  ('infraestrutura',      'Infraestrutura')
) AS v(slug, name)
WHERE NOT EXISTS (SELECT 1 FROM sectors LIMIT 1);

-- ------------------------------------------------------------
-- 4. Many-to-many: product ↔ sector
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_sectors (
  id          text        NOT NULL DEFAULT gen_random_uuid()::text,
  product_id  text        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sector_id   text        NOT NULL REFERENCES sectors(id)  ON DELETE CASCADE,
  created_at  timestamp   NOT NULL DEFAULT now(),

  CONSTRAINT product_sectors_pkey PRIMARY KEY (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS product_sectors_product_id_sector_id_uidx ON product_sectors(product_id, sector_id);
CREATE INDEX IF NOT EXISTS product_sectors_product_id_idx ON product_sectors(product_id);
CREATE INDEX IF NOT EXISTS product_sectors_sector_id_idx  ON product_sectors(sector_id);

-- ------------------------------------------------------------
-- 5. Enums for orders
-- ------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE order_status AS ENUM (
    'DRAFT',
    'PENDING',
    'APPROVED',
    'INVOICED',
    'REJECTED',
    'NO_BILLING'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE order_type AS ENUM (
    'SALE',
    'CONSIGNMENT',
    'DONATION',
    'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ------------------------------------------------------------
-- 6. orders (order header — from atlasmed.avulsa)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  id                        text          NOT NULL DEFAULT gen_random_uuid()::text,
  legacy_id                 integer       UNIQUE,
  facility_id               text          NOT NULL REFERENCES facilities(id),
  seller_id                 text          REFERENCES users(id),
  professional_id           text          REFERENCES professionals(id),
  status                    order_status  NOT NULL DEFAULT 'DRAFT',
  type                      order_type    NOT NULL DEFAULT 'SALE',
  surgery_type              text,
  surgery_subtype           text,
  ordered_at                timestamp     NOT NULL,
  notes                     text,
  freight                   numeric(10,2) NOT NULL DEFAULT 0,
  gross_weight              numeric(10,3) NOT NULL DEFAULT 0,
  net_weight                numeric(10,3) NOT NULL DEFAULT 0,
  currency                  text          NOT NULL DEFAULT 'BRL',
  usd_exchange_rate         numeric(10,4),
  finalized_by_id           text          REFERENCES users(id),
  finalized_at              timestamp,
  rejected_by_id            text          REFERENCES users(id),
  rejection_reason          text,
  no_billing_by_id          text          REFERENCES users(id),
  no_billing_at             timestamp,
  no_billing_notes          text,
  expense_authorized_by_id  text          REFERENCES users(id),
  expense_authorized_at     timestamp,
  created_at                timestamp     NOT NULL DEFAULT now(),
  updated_at                timestamp     NOT NULL DEFAULT now(),

  CONSTRAINT orders_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS orders_facility_id_idx      ON orders(facility_id);
CREATE INDEX IF NOT EXISTS orders_seller_id_idx         ON orders(seller_id);
CREATE INDEX IF NOT EXISTS orders_professional_id_idx  ON orders(professional_id);
CREATE INDEX IF NOT EXISTS orders_status_idx            ON orders(status);
CREATE INDEX IF NOT EXISTS orders_ordered_at_idx        ON orders(ordered_at);
CREATE INDEX IF NOT EXISTS orders_legacy_id_idx         ON orders(legacy_id);

-- ------------------------------------------------------------
-- 7. order_items (line items — from atlasmed.avulsa_envio_padrao)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_items (
  id                text          NOT NULL DEFAULT gen_random_uuid()::text,
  legacy_id         integer       UNIQUE,
  order_id          text          NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id        text          REFERENCES products(id),
  legacy_product_id integer,
  line_number       integer,
  quantity          numeric(12,3) NOT NULL DEFAULT 0,
  unit_price        numeric(12,2) NOT NULL DEFAULT 0,
  usd_price         numeric(12,4) NOT NULL DEFAULT 0,
  batch_number      text,
  written_off       boolean       NOT NULL DEFAULT false,
  created_at        timestamp     NOT NULL DEFAULT now(),
  updated_at        timestamp     NOT NULL DEFAULT now(),

  CONSTRAINT order_items_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS order_items_order_id_idx    ON order_items(order_id);
CREATE INDEX IF NOT EXISTS order_items_product_id_idx  ON order_items(product_id);
CREATE INDEX IF NOT EXISTS order_items_batch_number_idx ON order_items(batch_number);
