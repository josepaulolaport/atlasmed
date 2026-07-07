-- Remove legacy geo membership, rollup links, and parent-assignment columns

DROP TABLE IF EXISTS "territory_geo_membership";
DROP TABLE IF EXISTS "territory_rollup_links";

ALTER TABLE "territories" DROP COLUMN IF EXISTS "parentAssignmentStatus";
ALTER TABLE "territories" DROP COLUMN IF EXISTS "parentAssignmentSource";
ALTER TABLE "territories" DROP COLUMN IF EXISTS "geoMembershipStatus";

DROP TYPE IF EXISTS "TerritoryGeoMembershipStatus";
DROP TYPE IF EXISTS "TerritoryParentAssignmentStatus";
DROP TYPE IF EXISTS "TerritoryParentAssignmentSource";
DROP TYPE IF EXISTS "TerritoryRollupLinkSource";
DROP TYPE IF EXISTS "TerritoryRollupRelationshipType";

DROP INDEX IF EXISTS "territories_parentAssignmentStatus_idx";
