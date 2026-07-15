-- 1. Add enrichment columns to products
ALTER TABLE "products" ADD COLUMN "legacy_id" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "barcode" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "commercial_code" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "product_group" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "product_classification" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "brand" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "unit" text;--> statement-breakpoint

-- 2. Migrate existing sector_id data to product_sectors, then drop the FK column
CREATE TABLE IF NOT EXISTS "product_sectors" (
  "id" text PRIMARY KEY NOT NULL,
  "product_id" text NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "sector_id" text NOT NULL REFERENCES "sectors"("id") ON DELETE CASCADE,
  "created_at" timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint

INSERT INTO "product_sectors" ("product_id", "sector_id", "created_at")
SELECT "id", "sector_id", now() FROM "products" WHERE "sector_id" IS NOT NULL;--> statement-breakpoint

ALTER TABLE "products" DROP COLUMN "sector_id";--> statement-breakpoint

-- 3. Indexes
CREATE INDEX IF NOT EXISTS "products_is_active_idx" ON "products" ("is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_legacy_id_idx" ON "products" ("legacy_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "product_sectors_product_sector_uidx" ON "product_sectors" ("product_id", "sector_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_sectors_sector_id_idx" ON "product_sectors" ("sector_id");--> statement-breakpoint

-- 4. order_status and order_type enums
CREATE TYPE "public"."order_status" AS ENUM('DRAFT', 'PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."order_type" AS ENUM('STANDARD', 'URGENT', 'RETURN', 'SAMPLE');--> statement-breakpoint

-- 5. orders table
CREATE TABLE "orders" (
  "id" text PRIMARY KEY NOT NULL,
  "facility_id" text NOT NULL REFERENCES "facilities"("id") ON DELETE RESTRICT,
  "status" "order_status" NOT NULL DEFAULT 'DRAFT',
  "type" "order_type" NOT NULL DEFAULT 'STANDARD',
  "notes" text,
  "legacy_id" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "confirmed_at" timestamp,
  "shipped_at" timestamp,
  "delivered_at" timestamp,
  "cancelled_at" timestamp,
  "rejected_at" timestamp
);--> statement-breakpoint

-- 6. order_items table
CREATE TABLE "order_items" (
  "id" text PRIMARY KEY NOT NULL,
  "order_id" text NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
  "product_id" text NOT NULL REFERENCES "products"("id") ON DELETE RESTRICT,
  "legacy_product_id" text,
  "quantity" integer NOT NULL,
  "unit_price" numeric(15,4),
  "total_price" numeric(15,4),
  "notes" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint

-- 7. Orders indexes
CREATE INDEX IF NOT EXISTS "orders_facility_id_idx" ON "orders" ("facility_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_status_idx" ON "orders" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_legacy_id_idx" ON "orders" ("legacy_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_items_order_id_idx" ON "order_items" ("order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_items_product_id_idx" ON "order_items" ("product_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_items_legacy_product_id_idx" ON "order_items" ("legacy_product_id");
