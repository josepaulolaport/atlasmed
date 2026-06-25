-- Territory types (user-defined polygon characterization)
CREATE TABLE "territory_types" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "canHaveBoundary" BOOLEAN NOT NULL DEFAULT true,
  "assignsClinics" BOOLEAN NOT NULL DEFAULT false,
  "assignableToUsers" BOOLEAN NOT NULL DEFAULT false,
  "assignableToManagers" BOOLEAN NOT NULL DEFAULT false,
  "isCountryLevel" BOOLEAN NOT NULL DEFAULT false,
  "blockSiblingOverlap" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "territory_types_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "territory_types_slug_key" ON "territory_types"("slug");
CREATE INDEX "territory_types_isActive_idx" ON "territory_types"("isActive");

-- Seed default types matching legacy node types
INSERT INTO "territory_types" (
  "id", "slug", "name", "description",
  "canHaveBoundary", "assignsClinics", "assignableToUsers", "assignableToManagers",
  "isCountryLevel", "blockSiblingOverlap", "sortOrder", "isActive", "updatedAt"
) VALUES
  ('tt_country', 'country', 'Country', 'Top-level country territory', true, false, false, false, true, false, 10, true, NOW()),
  ('tt_region', 'region', 'Region', 'Macro region within a country', true, false, false, true, false, false, 20, true, NOW()),
  ('tt_state', 'state', 'State', 'State or province', true, false, false, true, false, false, 30, true, NOW()),
  ('tt_intermediate', 'intermediate', 'Intermediate', 'Sub-state organizational unit', true, false, false, true, false, false, 40, true, NOW()),
  ('tt_patch', 'patch', 'Patch', 'Leaf territory for clinic assignment', true, true, true, false, false, true, 50, true, NOW());

ALTER TABLE "territories" ADD COLUMN "slug" TEXT;
ALTER TABLE "territories" ADD COLUMN "territoryTypeId" TEXT;

-- Backfill slug from code (lowercase, unique)
UPDATE "territories"
SET "slug" = LOWER(REGEXP_REPLACE("code", '[^a-zA-Z0-9]+', '-', 'g'));

-- Resolve slug collisions by appending id suffix
UPDATE "territories" t
SET "slug" = t."slug" || '-' || LEFT(t."id", 6)
WHERE EXISTS (
  SELECT 1 FROM "territories" t2
  WHERE t2."slug" = t."slug" AND t2."id" <> t."id"
);

-- Map legacy node types to territory types
UPDATE "territories" SET "territoryTypeId" = 'tt_country'
WHERE "nodeType" IN ('root', 'region') AND "parentId" IS NULL;

UPDATE "territories" SET "territoryTypeId" = 'tt_region'
WHERE "territoryTypeId" IS NULL AND "nodeType" = 'region';

UPDATE "territories" SET "territoryTypeId" = 'tt_state'
WHERE "territoryTypeId" IS NULL AND "nodeType" = 'state';

UPDATE "territories" SET "territoryTypeId" = 'tt_intermediate'
WHERE "territoryTypeId" IS NULL AND "nodeType" = 'intermediate';

UPDATE "territories" SET "territoryTypeId" = 'tt_patch'
WHERE "territoryTypeId" IS NULL AND "nodeType" = 'patch';

UPDATE "territories" SET "territoryTypeId" = 'tt_intermediate'
WHERE "territoryTypeId" IS NULL;

ALTER TABLE "territories" ALTER COLUMN "slug" SET NOT NULL;
ALTER TABLE "territories" ALTER COLUMN "territoryTypeId" SET NOT NULL;

CREATE UNIQUE INDEX "territories_slug_key" ON "territories"("slug");
CREATE INDEX "territories_territoryTypeId_idx" ON "territories"("territoryTypeId");

ALTER TABLE "territories"
  ADD CONSTRAINT "territories_territoryTypeId_fkey"
  FOREIGN KEY ("territoryTypeId") REFERENCES "territory_types"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

DROP INDEX IF EXISTS "territories_country_region_key";

CREATE UNIQUE INDEX "territories_country_type_key"
  ON "territories" ("countryCode")
  WHERE "territoryTypeId" = 'tt_country' AND "isActive" = true;
