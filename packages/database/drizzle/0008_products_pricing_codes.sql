ALTER TABLE "products"
  ADD COLUMN "picture_url" text,
  ADD COLUMN "simpro_code" text NOT NULL DEFAULT '',
  ADD COLUMN "brasindice_code" text NOT NULL DEFAULT '',
  ADD COLUMN "tiss_code" text NOT NULL DEFAULT '',
  ADD COLUMN "manufacturer" text NOT NULL DEFAULT '',
  ADD COLUMN "country_of_origin" text NOT NULL DEFAULT '',
  ADD COLUMN "price" numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "price_17" numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "price_18" numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "price_20" numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "brasindice_updated_at" date NOT NULL DEFAULT CURRENT_DATE;

ALTER TABLE "products"
  ALTER COLUMN "simpro_code" DROP DEFAULT,
  ALTER COLUMN "brasindice_code" DROP DEFAULT,
  ALTER COLUMN "tiss_code" DROP DEFAULT,
  ALTER COLUMN "manufacturer" DROP DEFAULT,
  ALTER COLUMN "country_of_origin" DROP DEFAULT,
  ALTER COLUMN "price" DROP DEFAULT,
  ALTER COLUMN "price_17" DROP DEFAULT,
  ALTER COLUMN "price_18" DROP DEFAULT,
  ALTER COLUMN "price_20" DROP DEFAULT,
  ALTER COLUMN "brasindice_updated_at" DROP DEFAULT;

CREATE UNIQUE INDEX "products_simpro_code_unique" ON "products" ("simpro_code");
CREATE UNIQUE INDEX "products_brasindice_code_unique" ON "products" ("brasindice_code");
CREATE UNIQUE INDEX "products_tiss_code_unique" ON "products" ("tiss_code");

CREATE TABLE "facility_competitor_product_standards" (
  "id" text PRIMARY KEY NOT NULL,
  "facility_id" text NOT NULL,
  "competitor_product_id" text NOT NULL,
  "standardized_quantity" integer,
  "source" text NOT NULL DEFAULT 'crm',
  "source_first_seen_at" timestamp,
  "source_last_seen_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "facility_competitor_product_standards_facility_id_facilities_id_fk"
    FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE,
  CONSTRAINT "facility_competitor_product_standards_competitor_product_id_competitor_products_id_fk"
    FOREIGN KEY ("competitor_product_id") REFERENCES "competitor_products"("id") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX "facility_competitor_product_standards_pair_uidx"
  ON "facility_competitor_product_standards" ("facility_id", "competitor_product_id");

CREATE INDEX "facility_competitor_product_standards_facility_idx"
  ON "facility_competitor_product_standards" ("facility_id");

CREATE INDEX "facility_competitor_product_standards_competitor_idx"
  ON "facility_competitor_product_standards" ("competitor_product_id");
