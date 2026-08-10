-- Spec 0010 §4 — orders key on the facility vertical profile.
--
-- EXPAND half. This migration only ADDS: the new FK column, backfilled from data
-- already in the row, plus its indexes. Nothing is dropped and nothing is invented
-- — every value is derived from the (facility_id, vertical_id) pair the order
-- already carries. `facility_id` and `vertical_id` are removed by 0079 (CONTRACT),
-- along with their now-redundant indexes.
--
-- Hand-edited from `drizzle-kit generate`. The generated form was
-- `ADD COLUMN ... NOT NULL` with no default and no backfill, which cannot run
-- against a non-empty table. Constraint and index names are kept exactly as
-- generated so a future `generate` sees no drift.
--
-- Verified against the 2026-08-10T10:47Z production dump before writing this:
-- all 1131 orders map to exactly one profile, zero orphans, zero duplicate
-- (facility, vertical) pairs, zero orders on an inactive profile. The guards below
-- are therefore expected to pass silently — they exist because rows can be written
-- between that dump and this deploy, not because the known data is dirty.
--
-- Follows the guard pattern of 0029, which added the vertical_id this replaces:
-- add nullable, backfill, assert, constrain. Extended in one way — the assertions
-- carry counts and examples, because 0029's bare "backfill failed" told a failed
-- deploy nothing about scale.

-- Guard 1 — ambiguity, checked BEFORE writing anything.
-- The backfill joins on (facility_id, vertical_id). If that pair is not unique on
-- facility_vertical_profiles the join multiplies rows and the mapping is undefined.
DO $$
DECLARE
  dup_count  bigint;
  dup_sample text;
BEGIN
  SELECT count(*), string_agg(format('(facility %s, vertical %s x%s)', facility_id, vertical_id, n), ', ')
    INTO dup_count, dup_sample
  FROM (
    SELECT facility_id, vertical_id, count(*) AS n
    FROM "facility_vertical_profiles"
    GROUP BY facility_id, vertical_id
    HAVING count(*) > 1
    LIMIT 10
  ) d;

  IF COALESCE(dup_count, 0) > 0 THEN
    RAISE EXCEPTION
      'orders->profile: (facility_id, vertical_id) is not unique on facility_vertical_profiles - % duplicated pair(s). Backfill would be ambiguous. Samples: %',
      dup_count, dup_sample;
  END IF;
END $$;--> statement-breakpoint

-- Nullable first. The generated NOT NULL is applied after the backfill.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "facility_vertical_profile_id" bigint;--> statement-breakpoint

-- Backfill. Derives only; creates no profiles.
UPDATE "orders" AS o
SET "facility_vertical_profile_id" = p."id"
FROM "facility_vertical_profiles" AS p
WHERE o."facility_vertical_profile_id" IS NULL
  AND p."facility_id" = o."facility_id"
  AND p."vertical_id" = o."vertical_id";--> statement-breakpoint

-- Guard 2 — the orphan check, and the point of the whole migration.
--
-- An order that maps to no profile is pre-existing damage (spec 0010 §4: the count
-- measures how many orders the Emultec importer wrote with no profile). This
-- migration will NOT quarantine them, will NOT invent profiles, and will NOT drop
-- them. It aborts, and the exception carries the numbers a read-only audit would
-- have produced - including how much APPROVED/INVOICED revenue is involved, since
-- that is what makes discarding them unacceptable.
--
-- If this fires: create the missing profiles deliberately, then re-run. That is a
-- business decision and does not belong inside a migration.
DO $$
DECLARE
  orphan_total   bigint;
  orphan_revenue bigint;
  orphan_emultec bigint;
  orphan_pairs   bigint;
  sample         text;
BEGIN
  SELECT
    count(*),
    count(*) FILTER (
      WHERE status IN ('APPROVED', 'INVOICED') AND type IN ('SALE', 'CONSIGNMENT')
    ),
    count(*) FILTER (WHERE id_avulsa_emultec IS NOT NULL),
    count(DISTINCT (facility_id, vertical_id))
    INTO orphan_total, orphan_revenue, orphan_emultec, orphan_pairs
  FROM "orders"
  WHERE "facility_vertical_profile_id" IS NULL;

  IF orphan_total > 0 THEN
    SELECT string_agg(format('facility %s + vertical %s -> %s order(s)', facility_id, vertical_id, n), '; ')
      INTO sample
    FROM (
      SELECT facility_id, vertical_id, count(*) AS n
      FROM "orders"
      WHERE "facility_vertical_profile_id" IS NULL
      GROUP BY facility_id, vertical_id
      ORDER BY count(*) DESC
      LIMIT 10
    ) s;

    RAISE EXCEPTION E'orders->profile backfill incomplete - REFUSING to continue.\n'
      '  % order(s) across % (facility, vertical) pair(s) have no profile.\n'
      '  % of them are APPROVED/INVOICED SALE/CONSIGNMENT (real revenue).\n'
      '  % of them came from the Emultec importer.\n'
      '  Worst pairs: %\n'
      '  Fix: create the missing facility_vertical_profiles rows, then re-run. '
      'This migration will not invent or discard them.',
      orphan_total, orphan_pairs, orphan_revenue, orphan_emultec, sample;
  END IF;
END $$;--> statement-breakpoint

ALTER TABLE "orders" ALTER COLUMN "facility_vertical_profile_id" SET NOT NULL;--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_facility_vertical_profile_id_facility_vertical_profiles_id_fk'
  ) THEN
    ALTER TABLE "orders"
      ADD CONSTRAINT "orders_facility_vertical_profile_id_facility_vertical_profiles_id_fk"
      FOREIGN KEY ("facility_vertical_profile_id")
      REFERENCES "public"."facility_vertical_profiles"("id")
      ON DELETE restrict ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "orders_facility_vertical_profile_id_idx"
  ON "orders" USING btree ("facility_vertical_profile_id");--> statement-breakpoint

-- The funnel's index. `loadPurchaseDates` filters exactly this predicate; without a
-- matching partial index the funnel degrades to a sequential scan over every order
-- and nothing fails loudly.
CREATE INDEX IF NOT EXISTS "orders_valid_purchase_profile_ordered_at_idx"
  ON "orders" USING btree ("facility_vertical_profile_id","ordered_at" DESC NULLS LAST)
  WHERE "orders"."status" in ('APPROVED', 'INVOICED') and "orders"."type" in ('SALE', 'CONSIGNMENT');--> statement-breakpoint

-- Backs incremental search reindexing: orders touched since T, by profile.
CREATE INDEX IF NOT EXISTS "orders_updated_at_profile_id_idx"
  ON "orders" USING btree ("updated_at","facility_vertical_profile_id");
