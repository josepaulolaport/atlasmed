CREATE TABLE "professional_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"professional_id" text NOT NULL,
	"note" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visits" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"facility_id" text NOT NULL,
	"visited_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "competitor_product_sectors" DROP CONSTRAINT "competitor_product_sectors_unique";--> statement-breakpoint
ALTER TABLE "competitor_products" DROP CONSTRAINT "competitor_products_legacy_id_key";--> statement-breakpoint
ALTER TABLE "product_equivalences" DROP CONSTRAINT "product_equivalences_unique";--> statement-breakpoint
ALTER TABLE "product_sectors" DROP CONSTRAINT "product_sectors_unique";--> statement-breakpoint
ALTER TABLE "products" DROP CONSTRAINT "products_legacy_id_key";--> statement-breakpoint
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_legacy_id_key";--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_legacy_id_key";--> statement-breakpoint
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_product_id_products_id_fk";
--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_seller_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_professional_id_professionals_id_fk";
--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_finalized_by_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_rejected_by_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_no_billing_by_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_expense_authorized_by_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_facility_id_facilities_id_fk";
--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'DRAFT'::text;--> statement-breakpoint
DROP TYPE "public"."order_status";--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('DRAFT', 'PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REJECTED');--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'DRAFT'::"public"."order_status";--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DATA TYPE "public"."order_status" USING "status"::"public"."order_status";--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "type" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "type" SET DEFAULT 'STANDARD'::text;--> statement-breakpoint
DROP TYPE "public"."order_type";--> statement-breakpoint
CREATE TYPE "public"."order_type" AS ENUM('STANDARD', 'URGENT', 'RETURN', 'SAMPLE');--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "type" SET DEFAULT 'STANDARD'::"public"."order_type";--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "type" SET DATA TYPE "public"."order_type" USING "type"::"public"."order_type";--> statement-breakpoint
DROP INDEX "competitor_product_sectors_cp_id_idx";--> statement-breakpoint
DROP INDEX "competitor_products_manufacturer_idx";--> statement-breakpoint
DROP INDEX "product_equivalences_cp_id_idx";--> statement-breakpoint
DROP INDEX "product_equivalences_product_id_idx";--> statement-breakpoint
DROP INDEX "product_sectors_product_id_idx";--> statement-breakpoint
DROP INDEX "products_product_group_idx";--> statement-breakpoint
DROP INDEX "products_simpro_code_unique";--> statement-breakpoint
DROP INDEX "products_brasindice_code_unique";--> statement-breakpoint
DROP INDEX "products_tiss_code_unique";--> statement-breakpoint
DROP INDEX "order_items_batch_number_idx";--> statement-breakpoint
DROP INDEX "orders_ordered_at_idx";--> statement-breakpoint
DROP INDEX "orders_professional_id_idx";--> statement-breakpoint
DROP INDEX "orders_seller_id_idx";--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "legacy_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "quantity" SET DATA TYPE numeric(15, 4);--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "quantity" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "unit_price" SET DATA TYPE numeric(15, 4);--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "unit_price" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "usd_price" SET DATA TYPE numeric(15, 4);--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "usd_price" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "usd_price" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "ordered_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "freight" SET DATA TYPE numeric(15, 4);--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "freight" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "gross_weight" SET DATA TYPE numeric(15, 4);--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "gross_weight" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "net_weight" SET DATA TYPE numeric(15, 4);--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "net_weight" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "usd_exchange_rate" SET DATA TYPE numeric(15, 4);--> statement-breakpoint
ALTER TABLE "professional_notes" ADD CONSTRAINT "professional_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_notes" ADD CONSTRAINT "professional_notes_professional_id_professionals_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "professional_notes_professional_id_user_id_created_at_idx" ON "professional_notes" USING btree ("professional_id","user_id","created_at");--> statement-breakpoint
CREATE INDEX "professional_notes_user_id_created_at_idx" ON "professional_notes" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "visits_user_id_visited_at_idx" ON "visits" USING btree ("user_id","visited_at");--> statement-breakpoint
CREATE INDEX "visits_facility_id_visited_at_idx" ON "visits" USING btree ("facility_id","visited_at");--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "competitor_product_sectors_competitor_product_id_sector_id_uidx" ON "competitor_product_sectors" USING btree ("competitor_product_id","sector_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_equivalences_product_id_competitor_product_id_uidx" ON "product_equivalences" USING btree ("product_id","competitor_product_id");--> statement-breakpoint
CREATE INDEX "product_equivalences_competitor_product_idx" ON "product_equivalences" USING btree ("competitor_product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_sectors_product_sector_uidx" ON "product_sectors" USING btree ("product_id","sector_id");--> statement-breakpoint
CREATE INDEX "products_legacy_id_idx" ON "products" USING btree ("legacy_id");--> statement-breakpoint
CREATE INDEX "order_items_legacy_product_id_idx" ON "order_items" USING btree ("legacy_product_id");--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "legacy_supplier_id";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "legacy_created_at";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "internal_classification";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "requires_sterilization";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "anvisa_registration";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "ncm";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "image_url";--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_simpro_code_unique" UNIQUE("simpro_code");--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_brasindice_code_unique" UNIQUE("brasindice_code");--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_tiss_code_unique" UNIQUE("tiss_code");