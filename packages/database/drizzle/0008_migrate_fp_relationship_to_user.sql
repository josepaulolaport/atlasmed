-- Move relationship scores from facility_professionals (facility-scoped)
-- to user_professional_relationships (user × professional).
-- Prefer confirmed_by_user_id as the owning user when present.

INSERT INTO "user_professional_relationships" (
  "id",
  "user_id",
  "professional_id",
  "relationship_level",
  "created_at",
  "updated_at"
)
SELECT
  'upr_' || encode(sha256((fp.confirmed_by_user_id || ':' || fp.professional_id)::bytea), 'hex'),
  fp.confirmed_by_user_id,
  fp.professional_id,
  fp.relationship_level,
  COALESCE(fp.updated_at, now()),
  now()
FROM "facility_professionals" fp
WHERE fp.relationship_level IS NOT NULL
  AND fp.confirmed_by_user_id IS NOT NULL
ON CONFLICT ("user_id", "professional_id") DO UPDATE SET
  "relationship_level" = EXCLUDED."relationship_level",
  "updated_at" = now();

ALTER TABLE "facility_professionals" DROP COLUMN "relationship_level";
