-- Migration-readiness audit for spec 0010 §4 — orders key on the profile.
--
-- READ ONLY. Every statement is a SELECT. Safe to run against production.
--
-- Run:  psql "$DATABASE_URL" -f packages/database/scripts/audit-orders-profile-backfill.sql
--
-- Why this exists: the spec replaces orders.facility_id + orders.vertical_id with a single
-- facility_vertical_profile_id FK, and says orders whose (facility, vertical) pair has no
-- profile are "existing orphans — create profiles or quarantine". Which of those two the
-- migration does is a decision that needs the real number first. Both columns are NOT NULL
-- with real FKs, so the ONLY way an order can fail to map is a missing profile row.
--
-- Nothing here writes, locks or long-runs. Read the output, then we write the migration.

\echo ''
\echo '=== 1. Scale ==='
SELECT
  (SELECT count(*) FROM orders)                                      AS orders_total,
  (SELECT count(*) FROM facility_vertical_profiles)                  AS profiles_total,
  (SELECT count(DISTINCT (facility_id, vertical_id)) FROM orders)    AS distinct_pairs_in_orders;

\echo ''
\echo '=== 2. The number that decides the migration ==='
\echo '    mapped   = backfills cleanly'
\echo '    orphaned = no profile for that (facility, vertical) -> create or quarantine'
SELECT
  count(*) FILTER (WHERE p.id IS NOT NULL) AS mapped,
  count(*) FILTER (WHERE p.id IS NULL)     AS orphaned,
  round(
    100.0 * count(*) FILTER (WHERE p.id IS NULL) / NULLIF(count(*), 0),
    2
  )                                        AS orphaned_pct
FROM orders o
LEFT JOIN facility_vertical_profiles p
  ON p.facility_id = o.facility_id
 AND p.vertical_id = o.vertical_id;

\echo ''
\echo '=== 3. Would any order map to MORE than one profile? ==='
\echo '    Must be zero. A non-zero count means (facility, vertical) is not unique on'
\echo '    facility_vertical_profiles, and the backfill would be ambiguous.'
SELECT count(*) AS pairs_with_multiple_profiles
FROM (
  SELECT facility_id, vertical_id
  FROM facility_vertical_profiles
  GROUP BY facility_id, vertical_id
  HAVING count(*) > 1
) dup;

\echo ''
\echo '=== 4. Orphans by (facility, vertical), worst first ==='
\echo '    This is the work list if we choose "create profiles".'
SELECT
  o.facility_id,
  f.name                AS facility_name,
  o.vertical_id,
  v.code                AS vertical_code,
  count(*)              AS orphaned_orders,
  min(o.ordered_at)     AS first_order,
  max(o.ordered_at)     AS last_order,
  -- Does the facility have a profile in some OTHER vertical? If yes this is a
  -- mis-verticalled order; if no, the facility has no commercial presence at all.
  EXISTS (
    SELECT 1 FROM facility_vertical_profiles p2 WHERE p2.facility_id = o.facility_id
  )                     AS facility_has_any_profile,
  f.deactivated_at IS NOT NULL AS facility_deactivated
FROM orders o
LEFT JOIN facility_vertical_profiles p
  ON p.facility_id = o.facility_id AND p.vertical_id = o.vertical_id
LEFT JOIN facilities f         ON f.id = o.facility_id
LEFT JOIN business_verticals v ON v.id = o.vertical_id
WHERE p.id IS NULL
GROUP BY o.facility_id, f.name, o.vertical_id, v.code, f.deactivated_at
ORDER BY orphaned_orders DESC
LIMIT 50;

\echo ''
\echo '=== 5. Do orphans carry real money, or only drafts? ==='
\echo '    Orphans that are APPROVED/INVOICED SALE/CONSIGNMENT are revenue currently'
\echo '    invisible to every per-vertical metric. Quarantining those loses real data.'
SELECT
  o.status,
  o.type,
  count(*) AS orphaned_orders
FROM orders o
LEFT JOIN facility_vertical_profiles p
  ON p.facility_id = o.facility_id AND p.vertical_id = o.vertical_id
WHERE p.id IS NULL
GROUP BY o.status, o.type
ORDER BY orphaned_orders DESC;

\echo ''
\echo '=== 6. Are the orphans the Emultec importer? ==='
\echo '    The spec predicts this backfill measures importer damage. Imported orders'
\echo '    are the ones carrying an Emultec id.'
SELECT
  (o.id_avulsa_emultec IS NOT NULL) AS from_emultec,
  count(*)                          AS orphaned_orders
FROM orders o
LEFT JOIN facility_vertical_profiles p
  ON p.facility_id = o.facility_id AND p.vertical_id = o.vertical_id
WHERE p.id IS NULL
GROUP BY 1;

\echo ''
\echo '=== 7. FUNNEL SAFETY: does any profile stage change under the new keying? ==='
\echo '    The funnel reads orders by (facility_id, vertical_id) and writes'
\echo '    facility_vertical_profiles.purchase_funnel_stage. After the migration it'
\echo '    joins the profile directly. Those must select the SAME order set.'
\echo '    This counts profiles whose eligible-order set differs between the two.'
\echo '    Must be zero. Non-zero means the funnel would silently re-stage clinics.'
WITH eligible AS (
  SELECT o.facility_id, o.vertical_id, count(*) AS n, max(o.ordered_at) AS last_at
  FROM orders o
  WHERE o.status IN ('APPROVED', 'INVOICED')
    AND o.type   IN ('SALE', 'CONSIGNMENT')
  GROUP BY o.facility_id, o.vertical_id
)
SELECT
  count(*) FILTER (WHERE p.id IS NULL) AS eligible_orders_with_no_profile,
  count(*) FILTER (WHERE p.id IS NOT NULL) AS eligible_orders_that_map_cleanly
FROM eligible e
LEFT JOIN facility_vertical_profiles p
  ON p.facility_id = e.facility_id AND p.vertical_id = e.vertical_id;

\echo ''
\echo '=== 8. EMULTEC SAFETY: which verticals does the importer actually write? ==='
\echo '    The importer inserts (facility_id, vertical_id) directly. After the'
\echo '    migration it must resolve a profile instead, and dead-letter when there'
\echo '    is none. This shows how often that path would trigger today.'
SELECT
  v.code                                   AS vertical_code,
  count(*)                                 AS emultec_orders,
  count(*) FILTER (WHERE p.id IS NULL)     AS would_dead_letter_today
FROM orders o
JOIN business_verticals v ON v.id = o.vertical_id
LEFT JOIN facility_vertical_profiles p
  ON p.facility_id = o.facility_id AND p.vertical_id = o.vertical_id
WHERE o.id_avulsa_emultec IS NOT NULL
GROUP BY v.code
ORDER BY emultec_orders DESC;

\echo ''
\echo '=== 9. Inactive profiles ==='
\echo '    An order mapping only to is_active = false is not an orphan, but the'
\echo '    profile being inactive may be wrong. Informational.'
SELECT count(*) AS orders_mapping_to_inactive_profile
FROM orders o
JOIN facility_vertical_profiles p
  ON p.facility_id = o.facility_id AND p.vertical_id = o.vertical_id
WHERE p.is_active = false;
