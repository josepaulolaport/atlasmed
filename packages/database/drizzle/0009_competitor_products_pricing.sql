ALTER TABLE "competitor_products"
  ADD COLUMN "manufacturer" text,
  ADD COLUMN "country_of_origin" text,
  ADD COLUMN "price_17" numeric(12,2),
  ADD COLUMN "price_18" numeric(12,2),
  ADD COLUMN "price_20" numeric(12,2),
  ADD COLUMN "brasindice_updated_at" date;
