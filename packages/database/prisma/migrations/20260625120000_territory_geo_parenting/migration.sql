-- CreateEnum
CREATE TYPE "TerritoryRollupLinkSource" AS ENUM ('geo', 'manual');
CREATE TYPE "TerritoryParentAssignmentStatus" AS ENUM ('resolved', 'ambiguous', 'manual');
CREATE TYPE "TerritoryParentAssignmentSource" AS ENUM ('geo', 'inferred', 'manual');

-- AlterTable
ALTER TABLE "territories" ADD COLUMN "countryCode" TEXT;
ALTER TABLE "territories" ADD COLUMN "parentAssignmentStatus" "TerritoryParentAssignmentStatus" NOT NULL DEFAULT 'resolved';
ALTER TABLE "territories" ADD COLUMN "parentAssignmentSource" "TerritoryParentAssignmentSource";

ALTER TABLE "territory_rollup_links" ADD COLUMN "source" "TerritoryRollupLinkSource" NOT NULL DEFAULT 'manual';

-- Backfill country code for existing roots and descendants
UPDATE "territories" SET "countryCode" = 'BR' WHERE "nodeType" = 'root' AND "code" = 'BR';
UPDATE "territories" SET "countryCode" = 'BR' WHERE "countryCode" IS NULL;

CREATE INDEX "territories_countryCode_idx" ON "territories"("countryCode");
CREATE INDEX "territories_parentAssignmentStatus_idx" ON "territories"("parentAssignmentStatus");
CREATE INDEX "territory_rollup_links_territoryId_source_idx" ON "territory_rollup_links"("territoryId", "source");

CREATE UNIQUE INDEX "territories_country_root_key"
  ON "territories" ("countryCode")
  WHERE "nodeType" = 'root' AND "isActive" = true;

CREATE UNIQUE INDEX "territories_country_region_slug_key"
  ON "territories" ("countryCode", "regionSlug")
  WHERE "nodeType" = 'region' AND "regionSlug" IS NOT NULL AND "isActive" = true;
