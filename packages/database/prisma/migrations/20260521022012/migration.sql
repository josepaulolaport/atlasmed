/*
  Warnings:

  - The values [BOT] on the enum `AuthSessionDeviceType` will be removed. If these variants are still used in the database, this will fail.

*/
-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');

-- AlterEnum
BEGIN;
CREATE TYPE "AuthSessionDeviceType_new" AS ENUM ('DESKTOP', 'MOBILE', 'TABLET', 'UNKNOWN');
ALTER TABLE "public"."sessions" ALTER COLUMN "deviceType" DROP DEFAULT;
ALTER TABLE "sessions" ALTER COLUMN "deviceType" TYPE "AuthSessionDeviceType_new" USING ("deviceType"::text::"AuthSessionDeviceType_new");
ALTER TYPE "AuthSessionDeviceType" RENAME TO "AuthSessionDeviceType_old";
ALTER TYPE "AuthSessionDeviceType_new" RENAME TO "AuthSessionDeviceType";
DROP TYPE "public"."AuthSessionDeviceType_old";
ALTER TABLE "sessions" ALTER COLUMN "deviceType" SET DEFAULT 'UNKNOWN';
COMMIT;

-- CreateTable
CREATE TABLE "invitations" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "phoneNumber" TEXT,
    "tokenHash" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "roleId" TEXT NOT NULL,
    "invitedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invitations_tokenHash_key" ON "invitations"("tokenHash");

-- CreateIndex
CREATE INDEX "invitations_email_idx" ON "invitations"("email");

-- CreateIndex
CREATE INDEX "invitations_phoneNumber_idx" ON "invitations"("phoneNumber");

-- CreateIndex
CREATE INDEX "invitations_tokenHash_idx" ON "invitations"("tokenHash");

-- CreateIndex
CREATE INDEX "invitations_status_idx" ON "invitations"("status");

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
