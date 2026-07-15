-- competitor_products table
CREATE TABLE "competitor_products" (
  "id" text PRIMARY KEY NOT NULL,
  "competitor_name" text NOT NULL,
  "code" text,
  "name" text NOT NULL,
  "description" text,
  "barcode" text,
  "brand" text,
  "unit" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint

-- competitor_product_sectors join table
CREATE TABLE "competitor_product_sectors" (
  "id" text PRIMARY KEY NOT NULL,
  "competitor_product_id" text NOT NULL REFERENCES "competitor_products"("id") ON DELETE CASCADE,
  "sector_id" text NOT NULL REFERENCES "sectors"("id") ON DELETE CASCADE,
  "created_at" timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint

-- product_equivalences bridge table
CREATE TABLE "product_equivalences" (
  "id" text PRIMARY KEY NOT NULL,
  "product_id" text NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "competitor_product_id" text NOT NULL REFERENCES "competitor_products"("id") ON DELETE CASCADE,
  "note" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint

-- Indexes
CREATE INDEX IF NOT EXISTS "competitor_products_competitor_name_idx" ON "competitor_products" ("competitor_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "competitor_products_is_active_idx" ON "competitor_products" ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "competitor_product_sectors_competitor_product_id_sector_id_uidx" ON "competitor_product_sectors" ("competitor_product_id", "sector_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "competitor_product_sectors_sector_id_idx" ON "competitor_product_sectors" ("sector_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "product_equivalences_product_id_competitor_product_id_uidx" ON "product_equivalences" ("product_id", "competitor_product_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_equivalences_competitor_product_idx" ON "product_equivalences" ("competitor_product_id");
