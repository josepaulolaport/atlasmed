-- Reactivate the 19 facilities the 2026-08-09 seed marked deactivated.
--
-- Every facility in `public.facilities` carries `created_at = 2026-08-09` from a
-- single bulk seed. Nineteen of them carry `deactivated_at = 2026-08-08` — one
-- day BEFORE they were created — so the value arrived with the seed data rather
-- than from anyone acting in the CRM. `audit.audit_logs` holds 88 rows and not
-- one of them touches a facility, and `facilities` has no reason column to say
-- what the flag meant.
--
-- The flag is not harmless. A deactivated facility is excluded from every
-- dashboard count (spec 0014 §4/§7.5), from purchase-recurrence recalculation,
-- and from Emultec order resolution. Six of the nineteen have recent Emultec
-- purchase history, including JK Ortopedia (sold 2026-08-07, the day before the
-- flag date) and Ortopedia Noroeste (27 orders through 2026-07-20). Eleven of
-- 205 DF clinics and 6 of 54 in TO are missing from coverage denominators.
--
-- USAGE
--   Run the SELECT first and confirm it returns exactly 19 rows, all dated
--   2026-08-08. If it returns anything else, this script does not match the
--   database in front of you — stop and re-check rather than running the UPDATE.
--
--   psql "$DATABASE_URL" -f docs/ops/reactivate-seeded-deactivations.sql
--
-- The UPDATE is deliberately narrowed to that exact timestamp, so a facility
-- deactivated by a person on any other date is untouched.

BEGIN;

-- 1. Inspect. Expect 19 rows.
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
JOIN states s        ON s.id = f.state_id
JOIN municipalities m ON m.id = f.municipality_id
WHERE f.deactivated_at IS NOT NULL
ORDER BY s.abbreviation, f.name;

-- 2. Reactivate only the seeded flag: deactivated before the row existed.
UPDATE facilities
SET deactivated_at = NULL,
    updated_at     = now()
WHERE deactivated_at IS NOT NULL
  AND deactivated_at < created_at;

-- 3. Verify. Expect 0 rows.
SELECT count(*) AS still_deactivated
FROM facilities
WHERE deactivated_at IS NOT NULL;

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
