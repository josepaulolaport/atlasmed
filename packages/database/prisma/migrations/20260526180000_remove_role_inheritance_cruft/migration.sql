-- DropForeignKey
ALTER TABLE "roles" DROP CONSTRAINT IF EXISTS "roles_parentId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "roles_parentId_idx";

-- AlterTable
ALTER TABLE "roles" DROP COLUMN IF EXISTS "parentId",
DROP COLUMN IF EXISTS "permissions";
