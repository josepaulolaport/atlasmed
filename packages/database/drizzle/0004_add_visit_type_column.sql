ALTER TABLE "products" DROP CONSTRAINT "products_simpro_code_unique";--> statement-breakpoint
ALTER TABLE "products" DROP CONSTRAINT "products_brasindice_code_unique";--> statement-breakpoint
ALTER TABLE "products" DROP CONSTRAINT "products_tiss_code_unique";--> statement-breakpoint
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_product_id_products_id_fk";
--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_facility_id_facilities_id_fk";
--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'DRAFT'::text;--> statement-breakpoint
DROP TYPE "public"."order_status";--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('DRAFT', 'PENDING', 'APPROVED', 'INVOICED', 'REJECTED', 'NO_BILLING');--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'DRAFT'::"public"."order_status";--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DATA TYPE "public"."order_status" USING "status"::"public"."order_status";--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "type" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "type" SET DEFAULT 'SALE'::text;--> statement-breakpoint
DROP TYPE "public"."order_type";--> statement-breakpoint
CREATE TYPE "public"."order_type" AS ENUM('SALE', 'CONSIGNMENT', 'DONATION', 'OTHER');--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "type" SET DEFAULT 'SALE'::"public"."order_type";--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "type" SET DATA TYPE "public"."order_type" USING "type"::"public"."order_type";--> statement-breakpoint
DROP INDEX "competitor_product_sectors_competitor_product_id_sector_id_uidx";--> statement-breakpoint
DROP INDEX "product_equivalences_product_id_competitor_product_id_uidx";--> statement-breakpoint
DROP INDEX "product_equivalences_competitor_product_idx";--> statement-breakpoint
DROP INDEX "product_sectors_product_sector_uidx";--> statement-breakpoint
DROP INDEX "products_legacy_id_idx";--> statement-breakpoint
DROP INDEX "order_items_legacy_product_id_idx";--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "legacy_id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "quantity" SET DATA TYPE numeric(12, 3);--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "quantity" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "unit_price" SET DATA TYPE numeric(12, 2);--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "unit_price" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "usd_price" SET DATA TYPE numeric(12, 4);--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "usd_price" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "usd_price" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "ordered_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "freight" SET DATA TYPE numeric(10, 2);--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "freight" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "gross_weight" SET DATA TYPE numeric(10, 3);--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "gross_weight" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "net_weight" SET DATA TYPE numeric(10, 3);--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "net_weight" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "usd_exchange_rate" SET DATA TYPE numeric(10, 4);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "legacy_supplier_id" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "legacy_created_at" timestamp;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "internal_classification" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "requires_sterilization" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "anvisa_registration" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "ncm" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "visits" ADD COLUMN "type" varchar(50) DEFAULT 'visit' NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_professional_id_professionals_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_finalized_by_id_users_id_fk" FOREIGN KEY ("finalized_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_rejected_by_id_users_id_fk" FOREIGN KEY ("rejected_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_no_billing_by_id_users_id_fk" FOREIGN KEY ("no_billing_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_expense_authorized_by_id_users_id_fk" FOREIGN KEY ("expense_authorized_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "competitor_product_sectors_cp_id_idx" ON "competitor_product_sectors" USING btree ("competitor_product_id");--> statement-breakpoint
CREATE INDEX "competitor_products_manufacturer_idx" ON "competitor_products" USING btree ("manufacturer");--> statement-breakpoint
CREATE INDEX "product_equivalences_cp_id_idx" ON "product_equivalences" USING btree ("competitor_product_id");--> statement-breakpoint
CREATE INDEX "product_equivalences_product_id_idx" ON "product_equivalences" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_sectors_product_id_idx" ON "product_sectors" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "products_product_group_idx" ON "products" USING btree ("product_group");--> statement-breakpoint
CREATE UNIQUE INDEX "products_simpro_code_unique" ON "products" USING btree ("simpro_code");--> statement-breakpoint
CREATE UNIQUE INDEX "products_brasindice_code_unique" ON "products" USING btree ("brasindice_code");--> statement-breakpoint
CREATE UNIQUE INDEX "products_tiss_code_unique" ON "products" USING btree ("tiss_code");--> statement-breakpoint
CREATE INDEX "order_items_batch_number_idx" ON "order_items" USING btree ("batch_number");--> statement-breakpoint
CREATE INDEX "orders_ordered_at_idx" ON "orders" USING btree ("ordered_at");--> statement-breakpoint
CREATE INDEX "orders_professional_id_idx" ON "orders" USING btree ("professional_id");--> statement-breakpoint
CREATE INDEX "orders_seller_id_idx" ON "orders" USING btree ("seller_id");--> statement-breakpoint
ALTER TABLE "competitor_product_sectors" ADD CONSTRAINT "competitor_product_sectors_unique" UNIQUE("competitor_product_id","sector_id");--> statement-breakpoint
ALTER TABLE "competitor_products" ADD CONSTRAINT "competitor_products_legacy_id_key" UNIQUE("legacy_id");--> statement-breakpoint
ALTER TABLE "product_equivalences" ADD CONSTRAINT "product_equivalences_unique" UNIQUE("competitor_product_id","product_id");--> statement-breakpoint
ALTER TABLE "product_sectors" ADD CONSTRAINT "product_sectors_unique" UNIQUE("product_id","sector_id");--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_legacy_id_key" UNIQUE("legacy_id");--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_legacy_id_key" UNIQUE("legacy_id");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_legacy_id_key" UNIQUE("legacy_id");