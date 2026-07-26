-- P1.2: seed Dermatologia business vertical (catalog base).
-- Idempotent. Does NOT create zones/patches, profiles, or user assigns —
-- those are ops/product follow-ups (new territory rows per vertical, Q5).
-- Kill switch: set is_active = false on this row (no separate feature-flag system yet).
INSERT INTO "business_verticals" ("id", "code", "name", "is_active", "created_at", "updated_at")
SELECT
  'bv_dermatologia_p1',
  'DERMATOLOGIA',
  'Dermatologia',
  true,
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM "business_verticals" WHERE "code" = 'DERMATOLOGIA'
);
