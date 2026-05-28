-- Lockout is enforced via Redis (RateLimiterService); these columns were never incremented.
ALTER TABLE "users" DROP COLUMN IF EXISTS "failedLoginAttempts";
ALTER TABLE "users" DROP COLUMN IF EXISTS "lockedUntil";
ALTER TABLE "users" DROP COLUMN IF EXISTS "lastFailedLoginAt";
