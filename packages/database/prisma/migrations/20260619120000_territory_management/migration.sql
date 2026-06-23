-- CreateEnum
CREATE TYPE "TerritoryNodeType" AS ENUM ('root', 'region', 'state', 'intermediate', 'patch');

-- CreateEnum
CREATE TYPE "TerritoryAssignmentStatus" AS ENUM ('assigned', 'unassigned', 'ambiguous');

-- CreateEnum
CREATE TYPE "TerritoryAssignmentSource" AS ENUM ('geo', 'manual');

-- CreateEnum
CREATE TYPE "TerritoryApprovalType" AS ENUM ('create_territory', 'reparent_territory', 'deactivate_territory', 'clinic_territory_change');

-- CreateEnum
CREATE TYPE "TerritoryApprovalStatus" AS ENUM ('pending', 'approved', 'rejected', 'superseded');

-- PostGIS extension (required for boundary geometry)
CREATE EXTENSION IF NOT EXISTS postgis;

-- CreateTable
CREATE TABLE "territories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nodeType" "TerritoryNodeType" NOT NULL,
    "regionSlug" TEXT,
    "stateCode" TEXT,
    "parentId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "organizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "territories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "territory_closure" (
    "ancestorId" TEXT NOT NULL,
    "descendantId" TEXT NOT NULL,
    "depth" INTEGER NOT NULL,

    CONSTRAINT "territory_closure_pkey" PRIMARY KEY ("ancestorId","descendantId")
);

-- CreateTable
CREATE TABLE "territory_approval_requests" (
    "id" TEXT NOT NULL,
    "type" "TerritoryApprovalType" NOT NULL,
    "status" "TerritoryApprovalStatus" NOT NULL DEFAULT 'pending',
    "requesterId" TEXT NOT NULL,
    "reviewerId" TEXT,
    "entityPayload" JSONB NOT NULL DEFAULT '{}',
    "targetTerritoryId" TEXT,
    "clinicId" TEXT,
    "toTerritoryId" TEXT,
    "reason" TEXT,
    "resolutionNote" TEXT,
    "supersededById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "territory_approval_requests_pkey" PRIMARY KEY ("id")
);

-- PostGIS boundary column (not managed by Prisma)
ALTER TABLE "territories" ADD COLUMN "boundary" geometry(Geometry, 4326);
CREATE INDEX "idx_territories_boundary" ON "territories" USING GIST ("boundary");

-- Clinic territory assignment fields
ALTER TABLE "clinics" ADD COLUMN "lat" DOUBLE PRECISION;
ALTER TABLE "clinics" ADD COLUMN "lng" DOUBLE PRECISION;
ALTER TABLE "clinics" ADD COLUMN "territoryAssignmentStatus" "TerritoryAssignmentStatus" NOT NULL DEFAULT 'unassigned';
ALTER TABLE "clinics" ADD COLUMN "territoryAssignmentSource" "TerritoryAssignmentSource" NOT NULL DEFAULT 'geo';

-- Greenfield: clear legacy string territory references before FK enforcement
UPDATE "clinics" SET "territoryId" = NULL;
DELETE FROM "user_territory_assignments";

-- CreateIndex
CREATE UNIQUE INDEX "territories_code_key" ON "territories"("code");

-- CreateIndex
CREATE INDEX "territories_parentId_idx" ON "territories"("parentId");

-- CreateIndex
CREATE INDEX "territories_isActive_idx" ON "territories"("isActive");

-- CreateIndex
CREATE INDEX "territories_nodeType_idx" ON "territories"("nodeType");

-- CreateIndex
CREATE UNIQUE INDEX "territories_parentId_name_key" ON "territories"("parentId", "name");

-- CreateIndex
CREATE INDEX "territory_closure_descendantId_idx" ON "territory_closure"("descendantId");

-- CreateIndex
CREATE INDEX "territory_approval_requests_status_type_idx" ON "territory_approval_requests"("status", "type");

-- CreateIndex
CREATE INDEX "territory_approval_requests_requesterId_idx" ON "territory_approval_requests"("requesterId");

-- CreateIndex
CREATE INDEX "territory_approval_requests_targetTerritoryId_status_idx" ON "territory_approval_requests"("targetTerritoryId", "status");

-- CreateIndex
CREATE INDEX "territory_approval_requests_clinicId_status_type_idx" ON "territory_approval_requests"("clinicId", "status", "type");

-- CreateIndex
CREATE INDEX "clinics_territoryAssignmentStatus_idx" ON "clinics"("territoryAssignmentStatus");

-- AddForeignKey
ALTER TABLE "territories" ADD CONSTRAINT "territories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "territories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "territory_closure" ADD CONSTRAINT "territory_closure_ancestorId_fkey" FOREIGN KEY ("ancestorId") REFERENCES "territories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "territory_closure" ADD CONSTRAINT "territory_closure_descendantId_fkey" FOREIGN KEY ("descendantId") REFERENCES "territories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "territory_approval_requests" ADD CONSTRAINT "territory_approval_requests_targetTerritoryId_fkey" FOREIGN KEY ("targetTerritoryId") REFERENCES "territories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "territory_approval_requests" ADD CONSTRAINT "territory_approval_requests_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "territory_approval_requests" ADD CONSTRAINT "territory_approval_requests_toTerritoryId_fkey" FOREIGN KEY ("toTerritoryId") REFERENCES "territories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "territory_approval_requests" ADD CONSTRAINT "territory_approval_requests_supersededById_fkey" FOREIGN KEY ("supersededById") REFERENCES "territory_approval_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinics" ADD CONSTRAINT "clinics_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "territories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_territory_assignments" ADD CONSTRAINT "user_territory_assignments_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "territories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
