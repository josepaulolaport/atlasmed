-- Realign `facilities.unit_type_id` with what CNES says.
--
-- All 1 442 facilities were created in a single seed on 2026-08-09, and nine of
-- them carry a unit type that disagrees with the CNES establishment they are
-- bridged to. Spec 0015 §3.1 recorded those nine as deliberate corrections that
-- must not be overwritten. That was wrong: one seed on one day is not nine
-- hand-corrections, and in most cases our value is the worse of the two —
-- `Ares Hospital Dia LTDA` typed as Hospital Geral, `Acceb Clinica Popular`
-- typed as Home Care, a clinic typed as Cooperativa.
--
-- The rule this applies: **CNES is authoritative for unit type wherever CNES
-- supplies a code we can resolve.** Where it does not — code `16` appears on
-- establishments and is defined in no catalogue, ours or CNES's — our value is
-- kept, because a seeded guess beats no type at all.
--
-- Derived from the data rather than from a list of ids. Production may hold a
-- different set of divergences than the clone this was written against, and a
-- hardcoded list would silently fix nothing there. The same rule applied to
-- whatever is actually present is correct in both.
--
-- This migration cannot fail. It raises no exception, guards every object it
-- reads, updates zero rows when there is nothing to correct, and is idempotent:
-- a second run finds no divergence because the first removed them.
--
-- AFTER APPLYING: rebuild the facility search index. `unit_type_id` is a Meili
-- filter facet (`apps/workers/temporal/src/search/rebuild.ts`), so corrected
-- rows keep answering the old filter until the index is rebuilt. Nothing
-- commercial reads unit type — not potential, not the funnel, not territory —
-- so there is no recompute to schedule beyond the index.

DO $$
DECLARE
  corrected_n integer := 0;
  orphaned_n  integer := 0;
  sample      text;
BEGIN
  /*
   * Guard the cross-schema read. There is deliberately no foreign key between
   * `registry` and `public` (spec 0012: opposite lifecycles), so nothing
   * guarantees the mirror is present in the database this runs against.
   */
  IF to_regclass('registry.facilities') IS NULL THEN
    RAISE NOTICE 'registry.facilities is absent — no unit types realigned.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'registry'
       AND table_name   = 'facilities'
       AND column_name  = 'unit_type_code'
  ) THEN
    RAISE NOTICE 'registry.facilities.unit_type_code is absent — no unit types realigned.';
    RETURN;
  END IF;

  /*
   * One statement, deliberately. An earlier draft staged the work in a temp
   * table, which failed with `relation "realignment" already exists` when the
   * block ran twice in one session — a migration is meant to run once, but
   * "cannot fail" should not depend on that. A CTE carries no session state.
   */
  WITH realignment AS (
    SELECT f.id            AS facility_id,
           old_t.cnes_id   AS old_code,
           target.id       AS new_unit_type_id,
           target.cnes_id  AS new_code,
           /*
            * The subtype belongs to the *old* type. CNES scopes subtype codes
            * by unit type, so once the type changes the stored subtype
            * describes a classification the facility no longer has.
            */
           (f.unit_subtype_id IS NOT NULL AND sub.unit_type_id IS DISTINCT FROM target.id)
                           AS subtype_orphaned
      FROM facilities f
      JOIN registry.facilities rf
        ON rf.atlasmed_id = f.id
      /*
       * CNES ships the code both zero-padded and not (spec 0015 §4.3). Joining
       * on the raw value would miss every unpadded row. An unresolvable code —
       * `16`, or the rows where a date landed in the column at source — simply
       * fails to join, and the facility keeps what it has.
       */
      JOIN unit_types target
        ON target.cnes_id = lpad(nullif(btrim(rf.unit_type_code), ''), 2, '0')
      LEFT JOIN unit_types old_t
        ON old_t.id = f.unit_type_id
      LEFT JOIN unit_subtypes sub
        ON sub.id = f.unit_subtype_id
     WHERE target.id IS DISTINCT FROM f.unit_type_id
  ), corrected AS (
    UPDATE facilities f
       SET unit_type_id = r.new_unit_type_id,
           /*
            * Null rather than guessed. `rlEstabSubTipo` is not ingested yet, so
            * the correct subtype under the new type is genuinely unknown — and
            * leaving a subtype that belongs to another type would make the
            * facility unsavable: `resolveUnitCatalog` rejects the pair, so a
            * rep editing this clinic would hit a validation error with no way
            * out.
            */
           unit_subtype_id = CASE WHEN r.subtype_orphaned THEN NULL
                                  ELSE f.unit_subtype_id END,
           updated_at = now()
      FROM realignment r
     WHERE f.id = r.facility_id
    RETURNING r.facility_id, r.old_code, r.new_code, r.subtype_orphaned
  )
  SELECT count(*),
         count(*) FILTER (WHERE subtype_orphaned),
         string_agg(format('%s (%s → %s)', facility_id,
                           coalesce(old_code, 'none'), new_code),
                    ', ' ORDER BY facility_id) FILTER (WHERE rn <= 20)
    INTO corrected_n, orphaned_n, sample
    FROM (SELECT *, row_number() OVER (ORDER BY facility_id) AS rn
            FROM corrected) c;

  IF corrected_n = 0 THEN
    RAISE NOTICE 'Every bridged facility already agrees with CNES on unit type.';
    RETURN;
  END IF;

  RAISE NOTICE 'Realigned % facility unit type(s) with CNES: %', corrected_n, sample;

  IF orphaned_n > 0 THEN
    RAISE NOTICE
      'Cleared % unit_subtype_id(s) that belonged to the previous type. '
      'They are refilled once rlEstabSubTipo is ingested (spec 0015 §5 step 4).',
      orphaned_n;
  END IF;
END $$;
