-- Rename USER role to REP
UPDATE "public"."roles"
SET "name" = 'REP', "description" = 'Field Representative'
WHERE "name" = 'USER';

-- Add OPS role with priority between REP (10) and MANAGER (50)
INSERT INTO "public"."roles" ("id", "name", "description", "priority", "createdAt", "updatedAt")
VALUES (
  'ops_role_' || SUBSTRING(MD5(RANDOM()::TEXT), 1, 20),
  'OPS',
  'Operations (read-only)',
  20,
  NOW(),
  NOW()
)
ON CONFLICT ("name") DO NOTHING;
