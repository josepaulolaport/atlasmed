-- CreateEnum
CREATE TYPE "TerritoryGeoMembershipStatus" AS ENUM ('pending', 'ready', 'failed');

-- AlterTable
ALTER TABLE "territories" ADD COLUMN "geoMembershipStatus" "TerritoryGeoMembershipStatus";
ALTER TABLE "territories" ADD COLUMN "boundaryMinLng" DOUBLE PRECISION;
ALTER TABLE "territories" ADD COLUMN "boundaryMinLat" DOUBLE PRECISION;
ALTER TABLE "territories" ADD COLUMN "boundaryMaxLng" DOUBLE PRECISION;
ALTER TABLE "territories" ADD COLUMN "boundaryMaxLat" DOUBLE PRECISION;
ALTER TABLE "territories" ADD COLUMN "boundaryAreaSqKm" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "territory_geo_membership" (
    "id" TEXT NOT NULL,
    "operationalTerritoryId" TEXT NOT NULL,
    "referenceTerritoryId" TEXT NOT NULL,
    "referenceTypeSlug" TEXT NOT NULL,
    "overlapRatio" DOUBLE PRECISION NOT NULL,
    "intersectionAreaSqKm" DOUBLE PRECISION NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "territory_geo_membership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "territory_geo_membership_operationalTerritoryId_referenceTerritoryId_key" ON "territory_geo_membership"("operationalTerritoryId", "referenceTerritoryId");

-- CreateIndex
CREATE INDEX "territory_geo_membership_referenceTerritoryId_idx" ON "territory_geo_membership"("referenceTerritoryId");

-- CreateIndex
CREATE INDEX "territory_geo_membership_operationalTerritoryId_idx" ON "territory_geo_membership"("operationalTerritoryId");

-- AddForeignKey
ALTER TABLE "territory_geo_membership" ADD CONSTRAINT "territory_geo_membership_operationalTerritoryId_fkey" FOREIGN KEY ("operationalTerritoryId") REFERENCES "territories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "territory_geo_membership" ADD CONSTRAINT "territory_geo_membership_referenceTerritoryId_fkey" FOREIGN KEY ("referenceTerritoryId") REFERENCES "territories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
