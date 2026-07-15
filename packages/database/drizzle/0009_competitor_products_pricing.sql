ALTER TABLE "competitor_products"
  ADD COLUMN IF NOT EXISTS "manufacturer" text,
  ADD COLUMN IF NOT EXISTS "country_of_origin" text,
  ADD COLUMN IF NOT EXISTS "price_17" numeric(12,2),
  ADD COLUMN IF NOT EXISTS "price_18" numeric(12,2),
  ADD COLUMN IF NOT EXISTS "price_20" numeric(12,2),
  ADD COLUMN IF NOT EXISTS "brasindice_updated_at" date;
