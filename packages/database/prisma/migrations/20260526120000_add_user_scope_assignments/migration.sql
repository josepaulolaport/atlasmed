-- AlterEnum
ALTER TYPE "AuditEventType" ADD VALUE 'USER_MANAGER_ASSIGNED';
ALTER TYPE "AuditEventType" ADD VALUE 'USER_MANAGER_REMOVED';
ALTER TYPE "AuditEventType" ADD VALUE 'USER_TERRITORY_ASSIGNED';
ALTER TYPE "AuditEventType" ADD VALUE 'USER_TERRITORY_REVOKED';

-- AlterTable
ALTER TABLE "users" ADD COLUMN "managerId" TEXT;

-- CreateTable
CREATE TABLE "user_territory_assignments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "territoryId" TEXT NOT NULL,
    "assignedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_territory_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "users_managerId_idx" ON "users"("managerId");

-- CreateIndex
CREATE INDEX "user_territory_assignments_userId_idx" ON "user_territory_assignments"("userId");

-- CreateIndex
CREATE INDEX "user_territory_assignments_territoryId_idx" ON "user_territory_assignments"("territoryId");

-- CreateIndex
CREATE UNIQUE INDEX "user_territory_assignments_userId_territoryId_key" ON "user_territory_assignments"("userId", "territoryId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_territory_assignments" ADD CONSTRAINT "user_territory_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
