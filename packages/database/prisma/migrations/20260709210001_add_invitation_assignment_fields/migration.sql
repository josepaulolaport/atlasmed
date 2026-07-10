-- Add name and assignment fields to invitations
ALTER TABLE "public"."invitations" 
ADD COLUMN "firstName" TEXT,
ADD COLUMN "lastName" TEXT,
ADD COLUMN "managerId" TEXT,
ADD COLUMN "managerTerritoryId" TEXT,
ADD COLUMN "repTerritoryId" TEXT;

-- Add foreign key constraints
ALTER TABLE "public"."invitations"
ADD CONSTRAINT "invitations_managerId_fkey" 
FOREIGN KEY ("managerId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."invitations"
ADD CONSTRAINT "invitations_managerTerritoryId_fkey" 
FOREIGN KEY ("managerTerritoryId") REFERENCES "public"."territories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."invitations"
ADD CONSTRAINT "invitations_repTerritoryId_fkey" 
FOREIGN KEY ("repTerritoryId") REFERENCES "public"."territories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add indexes for foreign keys
CREATE INDEX "invitations_managerId_idx" ON "public"."invitations"("managerId");
CREATE INDEX "invitations_managerTerritoryId_idx" ON "public"."invitations"("managerTerritoryId");
CREATE INDEX "invitations_repTerritoryId_idx" ON "public"."invitations"("repTerritoryId");
