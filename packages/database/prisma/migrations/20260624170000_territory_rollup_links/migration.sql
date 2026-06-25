-- CreateEnum
CREATE TYPE "TerritoryRollupRelationshipType" AS ENUM ('reporting');

-- CreateTable
CREATE TABLE "territory_rollup_links" (
    "id" TEXT NOT NULL,
    "territoryId" TEXT NOT NULL,
    "ancestorId" TEXT NOT NULL,
    "relationshipType" "TerritoryRollupRelationshipType" NOT NULL DEFAULT 'reporting',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "territory_rollup_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "territory_rollup_links_ancestorId_idx" ON "territory_rollup_links"("ancestorId");

-- CreateIndex
CREATE UNIQUE INDEX "territory_rollup_links_territoryId_ancestorId_relationshipTyp_key" ON "territory_rollup_links"("territoryId", "ancestorId", "relationshipType");

-- AddForeignKey
ALTER TABLE "territory_rollup_links" ADD CONSTRAINT "territory_rollup_links_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "territories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "territory_rollup_links" ADD CONSTRAINT "territory_rollup_links_ancestorId_fkey" FOREIGN KEY ("ancestorId") REFERENCES "territories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
