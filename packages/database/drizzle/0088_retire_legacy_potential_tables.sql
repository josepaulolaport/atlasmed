-- Retire the two tables `facility_product_usage` (0087) replaces.
--
-- NEITHER TABLE CONVERTS. A single "potential" number cannot be decomposed into
-- per-competitor quantities, and a competitor standard has neither a metric nor
-- a profile to attach to. So this refuses rather than inventing a mapping — the
-- values must be archived and re-collected in the field.
--
-- Both were empty in the 2026-08-10 production snapshot and nothing references
-- them, but emptiness is checked at run time rather than assumed: the endpoints
-- that wrote `facility_potential_values` are live until this deploys, so rows
-- can appear between the snapshot and the migration. A guard that names what it
-- found beats a silent CASCADE.

DO $$
DECLARE
  potential_values bigint;
  competitor_standards bigint;
BEGIN
  SELECT count(*) INTO potential_values FROM facility_potential_values;
  SELECT count(*) INTO competitor_standards FROM facility_competitor_product_standards;

  IF potential_values > 0 OR competitor_standards > 0 THEN
    RAISE EXCEPTION
      'Refusing to run 0088: % facility_potential_values row(s) and % '
      'facility_competitor_product_standards row(s) would be destroyed. '
      'Neither converts to facility_product_usage — a single potential figure '
      'cannot be split across competitor products, and a competitor standard '
      'has no metric or profile. Archive them (CREATE TABLE _archive_x AS '
      'SELECT * FROM ...) and confirm the loss before re-running.',
      potential_values, competitor_standards;
  END IF;
END $$;--> statement-breakpoint

DROP TABLE "facility_competitor_product_standards" CASCADE;--> statement-breakpoint
DROP TABLE "facility_potential_values" CASCADE;
