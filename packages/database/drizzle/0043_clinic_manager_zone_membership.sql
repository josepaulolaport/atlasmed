-- Spec 0006: rep patches may overlap; clinic membership points at manager zone.
UPDATE "territory_types"
SET
  "block_sibling_overlap" = false,
  "description" = 'Rep patch. Contained in a manager zone. One rep per patch; may overlap sibling patches. Does not store clinic geo membership.',
  "updated_at" = now()
WHERE "slug" = 'patch';

UPDATE "territory_types"
SET
  "description" = 'Manager coverage zone. Contains rep patches. Clinic geo membership (manager_zone_id) targets this layer.',
  "updated_at" = now()
WHERE "slug" = 'manager_zone';

ALTER TABLE "facility_vertical_profiles" RENAME COLUMN "territory_id" TO "manager_zone_id";
ALTER INDEX "facility_vertical_profiles_territory_id_idx" RENAME TO "facility_vertical_profiles_manager_zone_id_idx";

-- Migrate membership from rep patch → parent manager zone when pointing at a patch.
UPDATE "facility_vertical_profiles" AS fvp
SET "manager_zone_id" = t."manager_territory_id"
FROM "territories" AS t
INNER JOIN "territory_types" AS tt ON tt."id" = t."territory_type_id"
WHERE fvp."manager_zone_id" = t."id"
  AND tt."slug" = 'patch'
  AND t."manager_territory_id" IS NOT NULL;

-- Patches with no parent zone (or still pointing at a patch after remap) cannot
-- be manager-zone membership — clear so FK + scope stay coherent.
UPDATE "facility_vertical_profiles" AS fvp
SET "manager_zone_id" = NULL
FROM "territories" AS t
INNER JOIN "territory_types" AS tt ON tt."id" = t."territory_type_id"
WHERE fvp."manager_zone_id" = t."id"
  AND tt."slug" = 'patch';
