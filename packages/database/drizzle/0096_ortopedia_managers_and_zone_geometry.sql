-- Ortopedia managers, and the zone geometry they are assigned (spec 0009, spec 0014 §2).
--
-- A DATA migration, not a schema one — the same shape as `0094_seed_ortopedia_catalog`,
-- so it reaches production through the deploy path rather than a script someone has to
-- remember to run.
--
-- Two things happen here, and the order matters:
--   1. every manager zone and rep patch is redrawn from `states.boundary`
--   2. three MANAGER users are created and assigned those zones
--
-- The five zones cover the twelve states that hold clinics, not the whole country. A
-- clinic created in one of the other fifteen (BA, MG, RS, SC, GO, MT, MS, ES and the
-- rest of the Nordeste) therefore lands with no manager zone — spec 0009's `no_zone`
-- case, which surfaces on the unassigned roster. Adding a "rest of Brazil" zone to catch
-- them was considered and rejected: those states hold no clinics and nobody works them,
-- so the zone would exist only to anticipate an expansion that has not happened.
--
-- ⚠️ CONFIRM THE THREE EMAIL ADDRESSES BEFORE MERGING. They follow the convention every
-- existing user uses (`jose.carlos.gondim@atlasmed.com.br`), but they were inferred, not
-- given. A wrong address means the password-reset link that activates the account goes
-- somewhere else.
--
-- IDEMPOTENT throughout: every insert is guarded and every update is a no-op on second
-- run, so a partial failure can be retried.

-- ⚠️ NO-OP ON A DATABASE WITHOUT THE ORTOPEDIA VERTICAL OR THE STATE BOUNDARIES.
--
-- `business_verticals` is seeded by no migration, and `states.boundary` is loaded by the
-- geography importer rather than by SQL. A fresh database (CI, a new environment) has
-- neither, and half of this migration is worse than none of it: zones with null
-- boundaries own no clinics, and managers assigned to them would look staffed while
-- seeing nothing. Every statement below is therefore guarded on both existing.

-- ── 1. Redraw every zone and patch from the state boundaries ────────────────────
--
-- Why all ten polygons (five zones, five patches) and not the two that were wrong:
-- the existing zones were drawn
-- from a coarser source than `states`, and they disagree with it in both directions. On
-- the 2026-08-10 snapshot that left 151 of 1443 profiles (10.5%) recording a
-- `manager_zone_id` whose boundary does not contain the clinic —
--
--   * 104 in Maranhão, 42 km to 491 km outside the "Norte" zone. Maranhão was inside no
--     zone and no patch at all; those clinics were assigned by something other than
--     geometry and would have been re-derived to `no_zone` — no manager, no rep — the
--     first time anything recomputed membership.
--   * 47 in Rio de Janeiro, 24 m to 950 m outside the "Rio de Janeiro" zone but inside
--     the RJ *state*. Coastline precision, invisible until someone edits that boundary.
--
-- The rep patches carry the identical defect in the identical places (Adriana Oliveira
-- 47, Jose Carlos Gondim 104), because each patch is congruent with its zone. Fixing
-- only the zone would leave a rep holding clinics their patch does not cover, which is
-- the invariant spec 0009 I2 exists to state.
--
-- Redrawing *only* the two broken zones was tried and rejected: the state polygons do
-- not overlap each other (0 m²), but a redrawn RJ overlaps the still-coarse "Sao Paulo"
-- zone by 46 km², and a redrawn Norte overlaps "Distrito Federal e Tocantins" by
-- 165 km² — a fresh violation of spec 0009 I3. One source for all ten, or none.
--
-- Maranhão joins Norte rather than a Nordeste zone because Jose Carlos Gondim already
-- works those 104 clinics: the recorded data was right and the boundary was wrong.

CREATE TEMPORARY TABLE ortopedia_zone_states AS
SELECT * FROM (VALUES
  ('Rio de Janeiro',               'Patch Adriana Oliveira',   ARRAY['RJ']),
  ('Sao Paulo',                    'Patch Eliana Ferreira',    ARRAY['SP']),
  ('Parana',                       'Patch Mauro Araujo',       ARRAY['PR']),
  ('Distrito Federal e Tocantins', 'Patch Flavio Ramalho',     ARRAY['DF','TO']),
  ('Norte',                        'Patch Jose Carlos Gondim', ARRAY['AC','AM','AP','PA','RO','RR','MA'])
) AS v(zone, patch, abbrs);

UPDATE territories t
   SET boundary = g.geom,
       updated_at = now()
  FROM (
    SELECT z.zone, z.patch, ST_Multi(ST_Union(s.boundary)) AS geom
      FROM ortopedia_zone_states z
      JOIN states s ON s.abbreviation = ANY(z.abbrs)
     GROUP BY z.zone, z.patch
  ) g
 WHERE (t.name = g.zone OR t.name = g.patch)
   AND t.vertical_id = (SELECT id FROM business_verticals WHERE code = 'ORTOPEDIA')
   -- Idempotent: the second run finds the geometry already equal and changes nothing.
   AND (t.boundary IS NULL OR NOT ST_Equals(t.boundary, g.geom));

-- ── 2. The three managers ───────────────────────────────────────────────────────
--
-- Created ACTIVE with an unusable password, which is the only shape that works against
-- the auth code as it stands:
--
--   * `users.password_hash` is NOT NULL, and `argon2.verify` throws on a malformed
--     string — `login.use-case.ts:84` verifies against the stored hash even for a
--     non-ACTIVE user, so a sentinel like '!' would be a 500 rather than a refusal.
--     Each hash below is a real argon2id digest of 32 random bytes that were generated
--     and discarded. No plaintext exists, so none of them can ever verify.
--   * PENDING would be the more honest status, but `reset-password.use-case.ts` never
--     promotes a user to ACTIVE, and `login.use-case.ts:83` refuses anything that is not
--     ACTIVE. A PENDING manager could set a password and still not get in.
--
-- So: ACTIVE, unusable password, and each of them activates through "esqueci minha
-- senha" — `request-password-reset.use-case.ts` has no status gate and emails the token.

INSERT INTO users (email, username, first_name, last_name, status, email_verified, password_hash, role_id)
SELECT v.email, v.username, v.first_name, v.last_name, 'ACTIVE', false, v.password_hash,
       (SELECT id FROM roles WHERE name = 'MANAGER')
  FROM (VALUES
    ('pedro.poggian@atlasmed.com.br',  'pedro.poggian',  'Pedro',   'Poggian',
     '$argon2id$v=19$m=65536,t=3,p=4$YyBe7bSgJRGIr7ZfL9JPBA$NN3iSqTGY4J5Ou1SacWfN/Mr8wqxu+mwLQ/stkZmOTI'),
    ('marcelo.moreno@atlasmed.com.br', 'marcelo.moreno', 'Marcelo', 'Moreno',
     '$argon2id$v=19$m=65536,t=3,p=4$+MDR+dli1l24+iLkRL9hWQ$khWd/LYkkJmO3pdg1X1i/93Ag1p19ThEds/swpiwzw8'),
    ('silvio.vieira@atlasmed.com.br',  'silvio.vieira',  'Silvio',  'Vieira',
     '$argon2id$v=19$m=65536,t=3,p=4$FT5EBJhlwAu6UEYk4Dzehg$Kn9NCJ940WzqwAU2MtTNzPaGJ34+tqzJBTgXKBRanNg')
  ) AS v(email, username, first_name, last_name, password_hash)
 WHERE EXISTS (SELECT 1 FROM roles WHERE name = 'MANAGER')
   AND NOT EXISTS (SELECT 1 FROM users u WHERE lower(u.email) = lower(v.email));

-- ── 3. Assign the zones ─────────────────────────────────────────────────────────
--
-- Pedro takes Rio de Janeiro, Marcelo takes São Paulo, and Silvio takes the remaining
-- three: Paraná, Distrito Federal e Tocantins and Norte. Membership is territory-derived
-- throughout (spec 0009), so this is what makes each rep report to a manager — there is
-- no `users.manager_id` to set.

INSERT INTO user_territory_assignments (user_id, territory_id)
SELECT u.id, t.id
  FROM (VALUES
    ('pedro.poggian@atlasmed.com.br',  'orto-mz-rj'),
    ('marcelo.moreno@atlasmed.com.br', 'orto-mz-sp'),
    ('silvio.vieira@atlasmed.com.br',  'orto-mz-pr'),
    ('silvio.vieira@atlasmed.com.br',  'orto-mz-df-to'),
    ('silvio.vieira@atlasmed.com.br',  'orto-mz-no')
  ) AS a(email, zone_slug)
  JOIN users u ON lower(u.email) = lower(a.email)
  JOIN territories t ON t.slug = a.zone_slug
   AND t.vertical_id = (SELECT id FROM business_verticals WHERE code = 'ORTOPEDIA')
 ON CONFLICT (user_id, territory_id) DO NOTHING;

-- ── 4. Re-derive clinic membership where the geometry now says otherwise ────────
--
-- The boundaries moved, so the denormalised `manager_zone_id` has to catch up. On the
-- snapshot this changes nothing — the 151 mismatched rows are mismatched precisely
-- because the *boundary* was wrong, and step 1 fixed it in their favour — but production
-- may have drifted since, and a column that disagrees with the geometry it is derived
-- from is the defect this migration exists to close.
--
-- Deliberately never writes NULL, and only acts when exactly one zone covers the clinic.
-- A clinic that somehow ends up under two zones, or none, keeps whatever it has and
-- surfaces on spec 0009's unassigned roster rather than being silently unowned by a
-- migration nobody is watching.

UPDATE facility_vertical_profiles p
   SET manager_zone_id = d.zone_id,
       updated_at = now()
  FROM (
    SELECT p.id AS profile_id, MIN(t.id) AS zone_id
      FROM facility_vertical_profiles p
      JOIN facilities f ON f.id = p.facility_id
      JOIN territories t
        ON t.vertical_id = p.vertical_id
       AND t.is_active
       AND ST_Covers(t.boundary, f.location)
      JOIN territory_types tt ON tt.id = t.territory_type_id AND tt.slug = 'manager_zone'
     WHERE f.deactivated_at IS NULL
     GROUP BY p.id
    HAVING COUNT(*) = 1
  ) d
 WHERE p.id = d.profile_id
   AND p.manager_zone_id IS DISTINCT FROM d.zone_id;

DROP TABLE IF EXISTS ortopedia_zone_states;
