-- Every facility comes from CNES, enforced by the database.
--
-- Spec 0015 makes importing from the registry the only way a facility comes
-- into existence. That is an invariant, not a policy: a check in a use case
-- holds only while that code path is the only writer, and the next migration,
-- script or endpoint would bypass it silently.
--
-- Two changes:
--
--   1. `cnes_code` becomes NOT NULL.
--   2. `facilities_cnes_code_uidx` becomes total.
--
-- The index is currently partial on `deactivated_at IS NULL`, so a deactivated
-- facility holding a code does not stop the same code being imported again —
-- which would leave two rows for one establishment and a registry bridge that
-- can only point at one of them. Made total, re-importing a deactivated
-- clinic's code can only reactivate the row that already exists.
--
-- Migration 0105 removed the single facility that had no code. This one refuses
-- to run rather than assume that worked, because a NULL here would otherwise
-- surface as a bare NOT NULL violation naming no row.

DO $$
DECLARE
  missing_n   integer;
  duplicate_n integer;
  sample      text;
BEGIN
  SELECT count(*) INTO missing_n FROM facilities WHERE cnes_code IS NULL;

  IF missing_n > 0 THEN
    SELECT string_agg(format('%s (%s)', id, name), ', ')
      INTO sample
      FROM (SELECT id, name FROM facilities WHERE cnes_code IS NULL ORDER BY id LIMIT 5) s;
    RAISE EXCEPTION
      '% facility/facilities still have no cnes_code: %. Each needs its CNES establishment '
      'found and linked, or removing, before this constraint can hold.',
      missing_n, sample;
  END IF;

  /*
   * Duplicates matter now in a way they did not before: the old index ignored
   * deactivated rows, so a repeated code could already exist and would only
   * surface here.
   */
  SELECT count(*) INTO duplicate_n
    FROM (SELECT cnes_code FROM facilities GROUP BY cnes_code HAVING count(*) > 1) d;

  IF duplicate_n > 0 THEN
    SELECT string_agg(cnes_code, ', ')
      INTO sample
      FROM (SELECT cnes_code FROM facilities GROUP BY cnes_code HAVING count(*) > 1 LIMIT 5) d;
    RAISE EXCEPTION
      '% cnes_code(s) appear on more than one facility: %. One establishment is one facility, '
      'so these must be merged before the index can be made total.',
      duplicate_n, sample;
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "facilities" ALTER COLUMN "cnes_code" SET NOT NULL;--> statement-breakpoint
DROP INDEX IF EXISTS "facilities_cnes_code_uidx";--> statement-breakpoint
CREATE UNIQUE INDEX "facilities_cnes_code_uidx" ON "facilities" USING btree ("cnes_code");
