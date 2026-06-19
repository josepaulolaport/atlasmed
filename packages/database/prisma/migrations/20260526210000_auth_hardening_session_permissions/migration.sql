-- Session refresh reuse detection + permission grant deduplication
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "previousRefreshTokenHash" TEXT;

CREATE INDEX IF NOT EXISTS "sessions_previousRefreshTokenHash_idx"
  ON "sessions"("previousRefreshTokenHash");

-- Deduplicate active permission grants before unique constraint
DELETE FROM "permissions" p
USING "permissions" p2
WHERE p.id > p2.id
  AND p."userId" = p2."userId"
  AND p.resource = p2.resource
  AND p.action = p2.action
  AND (p."resourceId" IS NOT DISTINCT FROM p2."resourceId");

CREATE UNIQUE INDEX IF NOT EXISTS "permissions_userId_resource_resourceId_action_key"
  ON "permissions"("userId", "resource", "resourceId", "action");
