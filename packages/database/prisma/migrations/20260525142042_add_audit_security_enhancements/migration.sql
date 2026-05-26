-- CreateEnum
CREATE TYPE "AuditEventType" AS ENUM ('USER_LOGIN', 'USER_LOGOUT', 'USER_REGISTER', 'USER_INVITE', 'USER_ACCEPT_INVITE', 'USER_DEACTIVATE', 'USER_ACTIVATE', 'USER_SUSPEND', 'USER_UNSUSPEND', 'PASSWORD_CHANGE', 'PASSWORD_RESET_REQUEST', 'PASSWORD_RESET_COMPLETE', 'EMAIL_CHANGE', 'PHONE_CHANGE', 'EMAIL_VERIFY', 'PHONE_VERIFY', 'ROLE_CHANGE', 'SESSION_CREATE', 'SESSION_REVOKE', 'PERMISSION_GRANT', 'PERMISSION_REVOKE', 'TWO_FACTOR_ENABLE', 'TWO_FACTOR_DISABLE', 'SUSPICIOUS_ACTIVITY', 'DATA_ACCESS', 'DATA_EXPORT');

-- CreateEnum
CREATE TYPE "AuditEventSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "VerificationTokenType" AS ENUM ('EMAIL_VERIFICATION', 'PHONE_VERIFICATION', 'EMAIL_CHANGE', 'PHONE_CHANGE');

-- AlterTable
ALTER TABLE "invitations" ADD COLUMN     "acceptedByUserId" TEXT,
ADD COLUMN     "lastResendAt" TIMESTAMP(3),
ADD COLUMN     "resendCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "parentId" TEXT,
ADD COLUMN     "permissions" JSONB,
ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "deviceFingerprint" TEXT,
ADD COLUMN     "deviceName" TEXT,
ADD COLUMN     "ipCity" TEXT,
ADD COLUMN     "ipCountry" TEXT,
ADD COLUMN     "lastIpAddress" TEXT,
ADD COLUMN     "suspiciousActivity" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "passwordExpiresAt" TIMESTAMP(3),
ADD COLUMN     "passwordHistory" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "phoneVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "suspendedAt" TIMESTAMP(3),
ADD COLUMN     "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "twoFactorSecret" TEXT;

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "eventType" "AuditEventType" NOT NULL,
    "severity" "AuditEventSeverity" NOT NULL DEFAULT 'INFO',
    "actor" TEXT,
    "actorId" TEXT,
    "resource" TEXT,
    "resourceId" TEXT,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "sessionId" TEXT,
    "outcome" TEXT,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "VerificationTokenType" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "newValue" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "action" TEXT NOT NULL,
    "conditions" JSONB,
    "grantedBy" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_eventType_idx" ON "audit_logs"("eventType");

-- CreateIndex
CREATE INDEX "audit_logs_severity_idx" ON "audit_logs"("severity");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_idx" ON "audit_logs"("actorId");

-- CreateIndex
CREATE INDEX "audit_logs_resourceId_idx" ON "audit_logs"("resourceId");

-- CreateIndex
CREATE INDEX "audit_logs_sessionId_idx" ON "audit_logs"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_tokenHash_key" ON "verification_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "verification_tokens_userId_idx" ON "verification_tokens"("userId");

-- CreateIndex
CREATE INDEX "verification_tokens_tokenHash_idx" ON "verification_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "verification_tokens_type_idx" ON "verification_tokens"("type");

-- CreateIndex
CREATE INDEX "verification_tokens_expiresAt_idx" ON "verification_tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "permissions_userId_idx" ON "permissions"("userId");

-- CreateIndex
CREATE INDEX "permissions_resource_resourceId_idx" ON "permissions"("resource", "resourceId");

-- CreateIndex
CREATE INDEX "permissions_userId_resource_idx" ON "permissions"("userId", "resource");

-- CreateIndex
CREATE INDEX "permissions_expiresAt_idx" ON "permissions"("expiresAt");

-- CreateIndex
CREATE INDEX "invitations_acceptedByUserId_idx" ON "invitations"("acceptedByUserId");

-- CreateIndex
CREATE INDEX "roles_parentId_idx" ON "roles"("parentId");

-- CreateIndex
CREATE INDEX "roles_priority_idx" ON "roles"("priority");

-- CreateIndex
CREATE INDEX "sessions_deviceFingerprint_idx" ON "sessions"("deviceFingerprint");

-- CreateIndex
CREATE INDEX "sessions_suspiciousActivity_idx" ON "sessions"("suspiciousActivity");

-- CreateIndex
CREATE INDEX "users_deletedAt_idx" ON "users"("deletedAt");

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_tokens" ADD CONSTRAINT "verification_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
