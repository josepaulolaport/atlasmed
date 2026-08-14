-- Reactivate the 19 facilities the 2026-08-09 seed marked deactivated.
--
-- Every facility in `public.facilities` carries `created_at = 2026-08-09` from a
-- single bulk seed. Nineteen of them carry `deactivated_at = 2026-08-08
-- 00:00:00` — one day BEFORE they were created, all on the exact same
-- midnight timestamp — so the value arrived with the seed data rather than from
-- anyone acting in the CRM. `audit.audit_logs` holds 88 rows and not one of them
-- touches a facility, and `facilities` has no reason column to say what the flag
-- meant.
--
-- The flag is not harmless. A deactivated facility is excluded from every
-- dashboard count (spec 0014 §4/§7.5), from purchase-recurrence recalculation,
-- and from Emultec order resolution. Six of the nineteen have recent Emultec
-- purchase history, including JK Ortopedia (sold 2026-08-07, the day before the
-- flag date) and Ortopedia Noroeste (27 orders through 2026-07-20). Eleven of
-- 205 DF clinics and 6 of 54 in TO are missing from coverage denominators.
--
-- USAGE
--   psql "$DATABASE_URL" -f docs/ops/reactivate-seeded-deactivations.sql
--
--   Step 1 must return exactly 19 rows and step 2 must return 0. If either
--   differs, this script does not match the database in front of you — stop.
--
-- SCOPE
--   The UPDATE is pinned to that one exact timestamp, so a facility deactivated
--   by a person on any other date is untouched no matter when this is run.
--
--   An earlier version claimed that but actually matched on
--   `deactivated_at < created_at`, which is a heuristic, not a fact: it would
--   also sweep up a legitimate deactivation that happened to predate a
--   backdated `created_at`. Verified 2026-08-14 against the 2026-08-09 prod
--   snapshot — all 19 carry `2026-08-08 00:00:00`, and no facility is
--   deactivated for any other reason.

BEGIN;

-- 1. The seeded flag. Expect exactly 19 rows.
SELECT
  f.id,
  f.name,
  f.legal_document,
  f.cnes_code,
  s.abbreviation AS uf,
  m.name         AS city,
  f.deactivated_at,
  f.created_at
FROM facilities f
JOIN states s         ON s.id = f.state_id
JOIN municipalities m ON m.id = f.municipality_id
WHERE f.deactivated_at = TIMESTAMP '2026-08-08 00:00:00'
ORDER BY s.abbreviation, f.name;

-- 2. Anything else that is deactivated. Expect 0 rows.
--    A row here is a deliberate deactivation by a person; this script must not
--    touch it. If any appear, read them before continuing.
SELECT f.id, f.name, f.deactivated_at, f.created_at
FROM facilities f
WHERE f.deactivated_at IS NOT NULL
  AND f.deactivated_at <> TIMESTAMP '2026-08-08 00:00:00'
ORDER BY f.deactivated_at;

-- 3. Reactivate only the seeded flag.
UPDATE facilities
SET deactivated_at = NULL,
    updated_at     = now()
WHERE deactivated_at = TIMESTAMP '2026-08-08 00:00:00';

-- 4. Verify. Expect 0.
SELECT count(*) AS seeded_still_deactivated
FROM facilities
WHERE deactivated_at = TIMESTAMP '2026-08-08 00:00:00';

COMMIT;

-- AFTER RUNNING
--
-- Reactivated facilities have never been through the funnel, so their profiles
-- still carry whatever `purchase_funnel_stage` they had when they were hidden.
-- Recalculate before trusting the dashboard:
--
--   POST /sync  { "entity": "orders" }
--
-- and re-run the Emultec importer so the six with purchase history resolve:
--
--   POST /sync  { "entity": "emultec-orders" }
--
-- Orders that were skipped because their clinic was deactivated are recorded in
-- `ops.emultec_order_import_pending` with `blocker = 'DOCUMENT'`, so the next
-- HYBRID run re-imports them on its own — no manual backfill needed.
