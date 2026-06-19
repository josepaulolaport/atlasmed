-- Remove password expiry column (feature removed)
ALTER TABLE "users" DROP COLUMN IF EXISTS "passwordExpiresAt";
