-- Spec 0010 §4 — CONTRACT half. Removes the legacy keying that 0078 replaced.
--
-- 0078 added facility_vertical_profile_id, backfilled it and made it NOT NULL.
-- It deliberately left facility_id and vertical_id in place so that deploy was
-- reversible; this one removes them, and is not reversible. `facility_id` is the
-- only record of which facility an order belonged to, so it goes only after 0078
-- has been verified in production (it was: applied cleanly on 2026-08-10, all
-- 1131 orders backfilled, no guard fired).
--
-- The dropped indexes are the (facility, vertical) forms that
-- orders_valid_purchase_profile_ordered_at_idx and
-- orders_updated_at_profile_id_idx replaced in 0078. Their replacements already
-- exist, so no query loses its index at any point.
--
-- Everything below the guard is exactly as `drizzle-kit generate` emitted it.

-- Belt and braces before an irreversible step. 0078's own guard already refused
-- to make the column NOT NULL with any row unmapped, and the constraint has held
-- since — so this cannot fire. It costs one count and is the last opportunity to
-- stop before the old keying is gone for good.
DO $$
DECLARE
  unmapped bigint;
BEGIN
  SELECT count(*) INTO unmapped
  FROM "orders" WHERE "facility_vertical_profile_id" IS NULL;

  IF unmapped > 0 THEN
    RAISE EXCEPTION
      'refusing to drop orders.facility_id/vertical_id: % order(s) have no profile. Dropping now would destroy the only record of which facility they belong to.',
      unmapped;
  END IF;
END $$;--> statement-breakpoint

ALTER TABLE "orders" DROP CONSTRAINT "orders_facility_id_facilities_id_fk";
--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_vertical_id_business_verticals_id_fk";
--> statement-breakpoint
DROP INDEX "orders_facility_id_idx";--> statement-breakpoint
DROP INDEX "orders_vertical_id_idx";--> statement-breakpoint
DROP INDEX "orders_valid_purchase_facility_ordered_at_idx";--> statement-breakpoint
DROP INDEX "orders_valid_purchase_facility_vertical_ordered_at_idx";--> statement-breakpoint
DROP INDEX "orders_updated_at_facility_id_idx";--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "facility_id";--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "vertical_id";