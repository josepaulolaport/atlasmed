-- Dual-graph territory model: manager zones + grouping hierarchy

ALTER TABLE "territory_types"
  ADD COLUMN "participatesInGroupingHierarchy" BOOLEAN NOT NULL DEFAULT false;

-- Seed manager_zone type
INSERT INTO "territory_types" (
  "id", "slug", "name", "description",
  "canHaveBoundary", "assignsClinics", "assignableToUsers", "assignableToManagers",
  "isCountryLevel", "blockSiblingOverlap", "participatesInGroupingHierarchy",
  "sortOrder", "isActive", "updatedAt"
) VALUES (
  'tt_manager_zone', 'manager_zone', 'Manager zone',
  'Flat assignment area for managers; rep patches must be fully contained',
  true, false, false, true,
  false, true, false,
  15, true, NOW()
) ON CONFLICT ("slug") DO NOTHING;

-- Grouping types participate in hierarchy only; not assignable to managers
UPDATE "territory_types"
SET
  "participatesInGroupingHierarchy" = true,
  "assignableToManagers" = false
WHERE "slug" IN ('country', 'region', 'state', 'intermediate');

-- Rep patches are not part of grouping tree
UPDATE "territory_types"
SET "participatesInGroupingHierarchy" = false
WHERE "slug" = 'patch';

ALTER TABLE "territories"
  ADD COLUMN "managerTerritoryId" TEXT;

ALTER TABLE "territories"
  ADD CONSTRAINT "territories_managerTerritoryId_fkey"
  FOREIGN KEY ("managerTerritoryId") REFERENCES "territories"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "territories_managerTerritoryId_idx" ON "territories"("managerTerritoryId");
