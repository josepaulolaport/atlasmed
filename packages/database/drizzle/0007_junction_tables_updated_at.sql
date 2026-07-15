-- Note: Drizzle migrator wraps each migration in a transaction; explicit BEGIN/COMMIT would cause nested transaction errors.

-- Add updated_at to junction tables to match the codebase convention
ALTER TABLE "product_sectors" ADD COLUMN "updated_at" timestamp NOT NULL DEFAULT now();--> statement-breakpoint
ALTER TABLE "competitor_product_sectors" ADD COLUMN "updated_at" timestamp NOT NULL DEFAULT now();--> statement-breakpoint
ALTER TABLE "product_equivalences" ADD COLUMN "updated_at" timestamp NOT NULL DEFAULT now();
-- end of migration
