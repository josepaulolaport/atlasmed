-- Spec 0013 §2 — competitor products merge into `products`.
--
-- "Competitor" is a statement about our commercial relationship to a product,
-- not a kind of product. Modelling it as a separate table produced two
-- near-identical tables, two vertical M2M tables, two repositories, two admin
-- surfaces, and a bridging table whose job was to reconnect what should never
-- have been split. `products.ownership` (added in 0082) replaces all of it.
--
-- **DROP TABLE ... CASCADE, so verified empty first.** Against the
-- 2026-08-10T10:47Z production dump:
--
--   competitor_products                     0 rows
--   competitor_product_verticals            0 rows
--   product_equivalences                    0 rows
--   facility_competitor_product_standards   0 rows
--
-- Nothing to migrate, and the two foreign keys that pointed at
-- competitor_products are repointed at products rather than dropped. The guard
-- below refuses if that has changed since — CASCADE would otherwise take real
-- rows with it, silently.
--
-- `products.code` and `products.price` become nullable because a competitor's
-- product has neither: we assign it no catalogue code, and there is no price of
-- ours to record. `code` keeps its uniqueness as a partial index, so our own
-- codes still cannot collide. manufacturer and country_of_origin stay NOT NULL —
-- the competitor API already requires both.

DO $$
DECLARE
  competitor_rows bigint;
  equivalence_rows bigint;
  standard_rows bigint;
BEGIN
  SELECT count(*) INTO competitor_rows FROM "competitor_products";
  SELECT count(*) INTO equivalence_rows FROM "product_equivalences";
  SELECT count(*) INTO standard_rows FROM "facility_competitor_product_standards";

  IF competitor_rows > 0 OR equivalence_rows > 0 OR standard_rows > 0 THEN
    RAISE EXCEPTION
      E'refusing to drop competitor_products: it is no longer empty.\n'
      '  competitor_products: %, product_equivalences: %, facility_competitor_product_standards: %\n'
      '  DROP TABLE ... CASCADE below would discard these rows and the links to them. '
      'Copy them into products with ownership = COMPETITOR first, repoint the '
      'foreign keys, then re-run.',
      competitor_rows, equivalence_rows, standard_rows;
  END IF;
END $$;--> statement-breakpoint

ALTER TABLE "competitor_product_verticals" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "competitor_products" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "competitor_product_verticals" CASCADE;--> statement-breakpoint
DROP TABLE "competitor_products" CASCADE;--> statement-breakpoint
-- IF EXISTS on all three, for two independent reasons — either alone would
-- fail this migration, and `drizzle-kit generate` accounts for neither:
--
-- 1. The DROP TABLE ... CASCADE above has already removed both foreign keys.
--    CASCADE takes dependent constraints with it, so by the time we get here
--    there is nothing left to drop.
-- 2. Postgres truncates identifiers at 63 characters. These were stored as
--    `facility_competitor_product_standards_competitor_product_id_com` and
--    `product_equivalences_competitor_product_id_competitor_products_`, not
--    under the full names drizzle emits, so the DROP could not have matched
--    even before the CASCADE.
ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_code_unique";--> statement-breakpoint
ALTER TABLE "facility_competitor_product_standards" DROP CONSTRAINT IF EXISTS "facility_competitor_product_standards_competitor_product_id_competitor_products_id_fk";
--> statement-breakpoint
ALTER TABLE "product_equivalences" DROP CONSTRAINT IF EXISTS "product_equivalences_competitor_product_id_competitor_products_id_fk";
--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "code" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "price" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "facility_competitor_product_standards" ADD CONSTRAINT "facility_competitor_product_standards_competitor_product_id_products_id_fk" FOREIGN KEY ("competitor_product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_equivalences" ADD CONSTRAINT "product_equivalences_competitor_product_id_products_id_fk" FOREIGN KEY ("competitor_product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "products_code_unique" ON "products" USING btree ("code") WHERE "products"."code" IS NOT NULL;