-- Spec 0010 §5.1 — drop purchase_status.
--
-- The column has no UPDATE and no non-default INSERT anywhere in the codebase.
-- Every row has read NON_BUYER since the 0024 backfill, so it carries no
-- information at all. Verified against the 2026-08-10T10:47Z production dump
-- before writing this: all 1443 facility_vertical_profiles rows are NON_BUYER,
-- zero exceptions.
--
-- `purchase_funnel_stage` replaces it as the single source for filtering,
-- display and calculation. Note they are not the same measure: purchase_status
-- was intensity (how much a clinic buys), the funnel is recency (whether they
-- are buying on schedule). Only the funnel has ever been maintained.
--
-- The guard exists because that dump is a snapshot. If anything wrote a real
-- value between then and this deploy, that is new information and dropping the
-- column would discard it — so this refuses instead, and says what it found.

DO $$
DECLARE
  informative bigint;
  sample      text;
BEGIN
  SELECT count(*) INTO informative
  FROM "facility_vertical_profiles"
  WHERE "purchase_status" <> 'NON_BUYER';

  IF informative > 0 THEN
    SELECT string_agg(format('%s x%s', purchase_status, n), ', ')
      INTO sample
    FROM (
      SELECT purchase_status, count(*) AS n
      FROM "facility_vertical_profiles"
      WHERE "purchase_status" <> 'NON_BUYER'
      GROUP BY purchase_status
    ) s;

    RAISE EXCEPTION
      'refusing to drop purchase_status: % profile(s) hold a non-default value (%). Something began writing it since the audit; dropping now would discard real data.',
      informative, sample;
  END IF;
END $$;--> statement-breakpoint

ALTER TABLE "facility_vertical_profiles" DROP COLUMN "purchase_status";--> statement-breakpoint
DROP TYPE "public"."purchase_status";