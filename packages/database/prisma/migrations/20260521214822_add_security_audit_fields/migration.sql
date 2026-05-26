-- AlterTable
ALTER TABLE "password_resets" ADD COLUMN     "ipAddress" TEXT,
ADD COLUMN     "userAgent" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastFailedLoginAt" TIMESTAMP(3),
ADD COLUMN     "lockedUntil" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "invitations_status_expiresAt_idx" ON "invitations"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "password_resets_userId_usedAt_idx" ON "password_resets"("userId", "usedAt");

-- CreateIndex
CREATE INDEX "sessions_userId_revokedAt_expiresAt_idx" ON "sessions"("userId", "revokedAt", "expiresAt");
