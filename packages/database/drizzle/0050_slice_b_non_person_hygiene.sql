ALTER TABLE "users" DROP CONSTRAINT "users_email_unique";--> statement-breakpoint
ALTER TABLE "competitor_products" DROP CONSTRAINT "competitor_products_legacy_id_key";--> statement-breakpoint
ALTER TABLE "products" DROP CONSTRAINT "products_legacy_id_key";--> statement-breakpoint
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_legacy_id_key";--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_legacy_id_key";--> statement-breakpoint
DROP INDEX IF EXISTS "invitations_token_hash_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "password_resets_token_hash_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "permissions_user_id_resource_resource_id_action_uidx";--> statement-breakpoint
DROP INDEX IF EXISTS "sessions_refresh_token_hash_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "users_email_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "users_username_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "users_phone_number_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "verification_tokens_token_hash_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "orders_legacy_id_idx";--> statement-breakpoint
ALTER TABLE "password_resets" ALTER COLUMN "ip_address" SET DATA TYPE inet USING "ip_address"::inet;--> statement-breakpoint
ALTER TABLE "permissions" ALTER COLUMN "conditions" SET DATA TYPE jsonb USING "conditions"::jsonb;--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "ip_address" SET DATA TYPE inet USING "ip_address"::inet;--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "last_ip_address" SET DATA TYPE inet USING "last_ip_address"::inet;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "metadata" SET DATA TYPE jsonb USING "metadata"::jsonb;--> statement-breakpoint
ALTER TABLE "facility_healthcare_provider_shares" ALTER COLUMN "share_percent" SET DATA TYPE numeric(5, 2) USING replace("share_percent", '%', '')::numeric(5, 2);--> statement-breakpoint
ALTER TABLE "review_decisions" ALTER COLUMN "flagged_file_asset_ids" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "review_decisions" ALTER COLUMN "flagged_file_asset_ids" SET DATA TYPE bigint[] USING (
  CASE
    WHEN "flagged_file_asset_ids" IS NULL OR cardinality("flagged_file_asset_ids") = 0 THEN '{}'::bigint[]
    ELSE ('{' || array_to_string("flagged_file_asset_ids", ',') || '}')::bigint[]
  END
);--> statement-breakpoint
ALTER TABLE "review_decisions" ALTER COLUMN "flagged_file_asset_ids" SET DEFAULT '{}'::bigint[];--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "currency" SET DATA TYPE char(3) USING "currency"::char(3);--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "currency" SET DEFAULT 'BRL';--> statement-breakpoint
ALTER TABLE "audit"."audit_logs" ALTER COLUMN "details" SET DATA TYPE jsonb USING "details"::jsonb;--> statement-breakpoint
ALTER TABLE "audit"."audit_logs" ALTER COLUMN "ip_address" SET DATA TYPE inet USING "ip_address"::inet;--> statement-breakpoint
ALTER TABLE "audit"."audit_logs" ALTER COLUMN "metadata" SET DATA TYPE jsonb USING "metadata"::jsonb;--> statement-breakpoint
ALTER TABLE "products" RENAME COLUMN "legacy_id" TO "id_produto_emultec";--> statement-breakpoint
ALTER TABLE "order_items" RENAME COLUMN "legacy_id" TO "id_avulsa_item_emultec";--> statement-breakpoint
ALTER TABLE "order_items" RENAME COLUMN "legacy_product_id" TO "id_produto_emultec";--> statement-breakpoint
ALTER TABLE "order_items" DROP COLUMN "line_number";--> statement-breakpoint
ALTER TABLE "orders" RENAME COLUMN "legacy_id" TO "id_avulsa_emultec";--> statement-breakpoint
ALTER TABLE "competitor_products" DROP COLUMN "legacy_id";--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_uidx" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "orders_id_avulsa_emultec_idx" ON "orders" USING btree ("id_avulsa_emultec");--> statement-breakpoint
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_user_id_resource_resource_id_action_key" UNIQUE NULLS NOT DISTINCT("user_id","resource","resource_id","action");--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_id_produto_emultec_key" UNIQUE("id_produto_emultec");--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_id_avulsa_item_emultec_key" UNIQUE("id_avulsa_item_emultec");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_id_avulsa_emultec_key" UNIQUE("id_avulsa_emultec");--> statement-breakpoint
ALTER TABLE "facility_healthcare_provider_shares" ADD CONSTRAINT "facility_healthcare_provider_shares_share_percent_check" CHECK ("facility_healthcare_provider_shares"."share_percent" >= 0 AND "facility_healthcare_provider_shares"."share_percent" <= 100);
