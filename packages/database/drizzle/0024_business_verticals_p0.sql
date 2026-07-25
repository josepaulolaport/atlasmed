-- Business Verticals P0: rename sectors→business_verticals, facility vertical profiles,
-- consultant vertical_id, drop territories.sector_id + facilities commercial columns.

-- 1) Rename sectors → business_verticals; slug → code
ALTER TABLE "sectors" RENAME TO "business_verticals";
--> statement-breakpoint
ALTER TABLE "business_verticals" RENAME CONSTRAINT "sectors_pkey" TO "business_verticals_pkey";
--> statement-breakpoint
ALTER TABLE "business_verticals" RENAME CONSTRAINT "sectors_slug_unique" TO "business_verticals_code_unique";
--> statement-breakpoint
ALTER INDEX "sectors_is_active_idx" RENAME TO "business_verticals_is_active_idx";
--> statement-breakpoint
ALTER TABLE "business_verticals" RENAME COLUMN "slug" TO "code";
--> statement-breakpoint
UPDATE "business_verticals"
SET
  "code" = 'ORTOPEDIA',
  "name" = 'Ortopedia',
  "updated_at" = now()
WHERE lower("code") IN ('orthopedics', 'ortopedia', 'ortopedics');
--> statement-breakpoint
INSERT INTO "business_verticals" ("id", "code", "name", "is_active", "created_at", "updated_at")
SELECT
  'bv_ortopedia_p0',
  'ORTOPEDIA',
  'Ortopedia',
  true,
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM "business_verticals" WHERE "code" = 'ORTOPEDIA'
);
--> statement-breakpoint

-- 2) user_sector_assignments → user_vertical_assignments
ALTER TABLE "user_sector_assignments" RENAME TO "user_vertical_assignments";
--> statement-breakpoint
ALTER TABLE "user_vertical_assignments" RENAME COLUMN "sector_id" TO "vertical_id";
--> statement-breakpoint
ALTER TABLE "user_vertical_assignments" RENAME CONSTRAINT "user_sector_assignments_pkey" TO "user_vertical_assignments_pkey";
--> statement-breakpoint
ALTER TABLE "user_vertical_assignments" RENAME CONSTRAINT "user_sector_assignments_user_id_users_id_fk" TO "user_vertical_assignments_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "user_vertical_assignments" RENAME CONSTRAINT "user_sector_assignments_sector_id_sectors_id_fk" TO "user_vertical_assignments_vertical_id_business_verticals_id_fk";
--> statement-breakpoint
ALTER TABLE "user_vertical_assignments" RENAME CONSTRAINT "user_sector_assignments_assigned_by_user_id_users_id_fk" TO "user_vertical_assignments_assigned_by_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "user_vertical_assignments" RENAME CONSTRAINT "user_sector_assignments_manager_id_users_id_fk" TO "user_vertical_assignments_manager_id_users_id_fk";
--> statement-breakpoint
ALTER INDEX "user_sector_assignments_user_id_sector_id_uidx" RENAME TO "user_vertical_assignments_user_id_vertical_id_uidx";
--> statement-breakpoint
ALTER INDEX "user_sector_assignments_user_id_idx" RENAME TO "user_vertical_assignments_user_id_idx";
--> statement-breakpoint
ALTER INDEX "user_sector_assignments_sector_id_idx" RENAME TO "user_vertical_assignments_vertical_id_idx";
--> statement-breakpoint
ALTER INDEX "user_sector_assignments_manager_id_idx" RENAME TO "user_vertical_assignments_manager_id_idx";
--> statement-breakpoint

-- 3) invitation_sector_assignments → invitation_vertical_assignments
ALTER TABLE "invitation_sector_assignments" RENAME TO "invitation_vertical_assignments";
--> statement-breakpoint
ALTER TABLE "invitation_vertical_assignments" RENAME COLUMN "sector_id" TO "vertical_id";
--> statement-breakpoint
ALTER TABLE "invitation_vertical_assignments" RENAME CONSTRAINT "invitation_sector_assignments_pkey" TO "invitation_vertical_assignments_pkey";
--> statement-breakpoint
ALTER TABLE "invitation_vertical_assignments" RENAME CONSTRAINT "invitation_sector_assignments_invitation_id_invitations_id_fk" TO "invitation_vertical_assignments_invitation_id_invitations_id_fk";
--> statement-breakpoint
ALTER TABLE "invitation_vertical_assignments" RENAME CONSTRAINT "invitation_sector_assignments_sector_id_sectors_id_fk" TO "invitation_vertical_assignments_vertical_id_business_verticals_id_fk";
--> statement-breakpoint
ALTER TABLE "invitation_vertical_assignments" RENAME CONSTRAINT "invitation_sector_assignments_manager_id_users_id_fk" TO "invitation_vertical_assignments_manager_id_users_id_fk";
--> statement-breakpoint
ALTER INDEX "invitation_sector_assignments_invitation_id_sector_id_uidx" RENAME TO "invitation_vertical_assignments_invitation_id_vertical_id_uidx";
--> statement-breakpoint
ALTER INDEX "invitation_sector_assignments_invitation_id_idx" RENAME TO "invitation_vertical_assignments_invitation_id_idx";
--> statement-breakpoint
ALTER INDEX "invitation_sector_assignments_sector_id_idx" RENAME TO "invitation_vertical_assignments_vertical_id_idx";
--> statement-breakpoint
ALTER INDEX "invitation_sector_assignments_manager_id_idx" RENAME TO "invitation_vertical_assignments_manager_id_idx";
--> statement-breakpoint

-- 4) invitation_territory_assignments.sector_id → vertical_id
ALTER TABLE "invitation_territory_assignments" RENAME COLUMN "sector_id" TO "vertical_id";
--> statement-breakpoint
ALTER TABLE "invitation_territory_assignments" RENAME CONSTRAINT "invitation_territory_assignments_sector_id_sectors_id_fk" TO "invitation_territory_assignments_vertical_id_business_verticals_id_fk";
--> statement-breakpoint
ALTER INDEX "invitation_territory_assignments_sector_id_idx" RENAME TO "invitation_territory_assignments_vertical_id_idx";
--> statement-breakpoint

-- 5) product_sectors → product_verticals
ALTER TABLE "product_sectors" RENAME TO "product_verticals";
--> statement-breakpoint
ALTER TABLE "product_verticals" RENAME COLUMN "sector_id" TO "vertical_id";
--> statement-breakpoint
ALTER TABLE "product_verticals" RENAME CONSTRAINT "product_sectors_pkey" TO "product_verticals_pkey";
--> statement-breakpoint
ALTER TABLE "product_verticals" RENAME CONSTRAINT "product_sectors_product_id_products_id_fk" TO "product_verticals_product_id_products_id_fk";
--> statement-breakpoint
ALTER TABLE "product_verticals" RENAME CONSTRAINT "product_sectors_sector_id_sectors_id_fk" TO "product_verticals_vertical_id_business_verticals_id_fk";
--> statement-breakpoint
ALTER TABLE "product_verticals" RENAME CONSTRAINT "product_sectors_unique" TO "product_verticals_unique";
--> statement-breakpoint
ALTER INDEX "product_sectors_product_id_idx" RENAME TO "product_verticals_product_id_idx";
--> statement-breakpoint
ALTER INDEX "product_sectors_sector_id_idx" RENAME TO "product_verticals_vertical_id_idx";
--> statement-breakpoint

-- 6) competitor_product_sectors → competitor_product_verticals
ALTER TABLE "competitor_product_sectors" RENAME TO "competitor_product_verticals";
--> statement-breakpoint
ALTER TABLE "competitor_product_verticals" RENAME COLUMN "sector_id" TO "vertical_id";
--> statement-breakpoint
ALTER TABLE "competitor_product_verticals" RENAME CONSTRAINT "competitor_product_sectors_pkey" TO "competitor_product_verticals_pkey";
--> statement-breakpoint
ALTER TABLE "competitor_product_verticals" RENAME CONSTRAINT "competitor_product_sectors_competitor_product_id_competitor_pro" TO "competitor_product_verticals_competitor_product_id_competitor_products_id_fk";
--> statement-breakpoint
ALTER TABLE "competitor_product_verticals" RENAME CONSTRAINT "competitor_product_sectors_sector_id_sectors_id_fk" TO "competitor_product_verticals_vertical_id_business_verticals_id_fk";
--> statement-breakpoint
ALTER TABLE "competitor_product_verticals" RENAME CONSTRAINT "competitor_product_sectors_unique" TO "competitor_product_verticals_unique";
--> statement-breakpoint
ALTER INDEX "competitor_product_sectors_cp_id_idx" RENAME TO "competitor_product_verticals_cp_id_idx";
--> statement-breakpoint
ALTER INDEX "competitor_product_sectors_sector_id_idx" RENAME TO "competitor_product_verticals_vertical_id_idx";
--> statement-breakpoint

-- 7) conformity_requirements.sector_id → vertical_id
ALTER TABLE "conformity_requirements" RENAME COLUMN "sector_id" TO "vertical_id";
--> statement-breakpoint
ALTER TABLE "conformity_requirements" RENAME CONSTRAINT "conformity_requirements_sector_id_sectors_id_fk" TO "conformity_requirements_vertical_id_business_verticals_id_fk";
--> statement-breakpoint
ALTER INDEX "conformity_requirements_sector_id_idx" RENAME TO "conformity_requirements_vertical_id_idx";
--> statement-breakpoint

-- 8) Remap all FK rows to Ortopedia (P0 single vertical)
UPDATE "user_vertical_assignments" u
SET "vertical_id" = v.id, "updated_at" = now()
FROM "business_verticals" v
WHERE v.code = 'ORTOPEDIA' AND u.vertical_id <> v.id;
--> statement-breakpoint
UPDATE "invitation_vertical_assignments" i
SET "vertical_id" = v.id, "updated_at" = now()
FROM "business_verticals" v
WHERE v.code = 'ORTOPEDIA' AND i.vertical_id <> v.id;
--> statement-breakpoint
UPDATE "invitation_territory_assignments" i
SET "vertical_id" = v.id, "updated_at" = now()
FROM "business_verticals" v
WHERE v.code = 'ORTOPEDIA' AND i.vertical_id <> v.id;
--> statement-breakpoint
UPDATE "product_verticals" p
SET "vertical_id" = v.id
FROM "business_verticals" v
WHERE v.code = 'ORTOPEDIA' AND p.vertical_id <> v.id;
--> statement-breakpoint
UPDATE "competitor_product_verticals" p
SET "vertical_id" = v.id
FROM "business_verticals" v
WHERE v.code = 'ORTOPEDIA' AND p.vertical_id <> v.id;
--> statement-breakpoint
UPDATE "conformity_requirements" c
SET "vertical_id" = v.id, "updated_at" = now()
FROM "business_verticals" v
WHERE v.code = 'ORTOPEDIA' AND c.vertical_id IS NOT NULL AND c.vertical_id <> v.id;
--> statement-breakpoint
UPDATE "facilities" f
SET "primary_sector_id" = v.id, "updated_at" = now()
FROM "business_verticals" v
WHERE v.code = 'ORTOPEDIA' AND f.primary_sector_id IS NOT NULL AND f.primary_sector_id <> v.id;
--> statement-breakpoint
UPDATE "territories" t
SET "sector_id" = NULL, "updated_at" = now()
WHERE t.sector_id IS NOT NULL;
--> statement-breakpoint
DELETE FROM "business_verticals" WHERE "code" <> 'ORTOPEDIA';
--> statement-breakpoint

-- 9) facility_vertical_profiles + backfill from facilities commercial columns
CREATE TABLE "facility_vertical_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"facility_id" text NOT NULL,
	"vertical_id" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"commercial_status" "commercial_status",
	"purchase_status" "purchase_status",
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "facility_vertical_profiles" ADD CONSTRAINT "facility_vertical_profiles_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "facility_vertical_profiles" ADD CONSTRAINT "facility_vertical_profiles_vertical_id_business_verticals_id_fk" FOREIGN KEY ("vertical_id") REFERENCES "public"."business_verticals"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "facility_vertical_profiles_facility_id_vertical_id_uidx" ON "facility_vertical_profiles" USING btree ("facility_id","vertical_id");
--> statement-breakpoint
CREATE INDEX "facility_vertical_profiles_facility_id_idx" ON "facility_vertical_profiles" USING btree ("facility_id");
--> statement-breakpoint
CREATE INDEX "facility_vertical_profiles_vertical_id_idx" ON "facility_vertical_profiles" USING btree ("vertical_id");
--> statement-breakpoint
CREATE INDEX "facility_vertical_profiles_commercial_status_idx" ON "facility_vertical_profiles" USING btree ("commercial_status");
--> statement-breakpoint
INSERT INTO "facility_vertical_profiles" (
  "id",
  "facility_id",
  "vertical_id",
  "is_active",
  "commercial_status",
  "purchase_status",
  "created_at",
  "updated_at"
)
SELECT
  'fvp_' || f.id,
  f.id,
  v.id,
  true,
  f.commercial_status,
  f.purchase_status,
  now(),
  now()
FROM "facilities" f
CROSS JOIN "business_verticals" v
WHERE v.code = 'ORTOPEDIA';
--> statement-breakpoint

-- 10) Drop commercial columns + primary_sector from facilities
ALTER TABLE "facilities" DROP CONSTRAINT IF EXISTS "facilities_primary_sector_id_sectors_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "facilities_primary_sector_id_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "facilities_commercial_status_idx";
--> statement-breakpoint
ALTER TABLE "facilities" DROP COLUMN IF EXISTS "primary_sector_id";
--> statement-breakpoint
ALTER TABLE "facilities" DROP COLUMN IF EXISTS "commercial_status";
--> statement-breakpoint
ALTER TABLE "facilities" DROP COLUMN IF EXISTS "purchase_status";
--> statement-breakpoint

-- 11) consultant.vertical_id + active unique per facility×vertical
ALTER TABLE "facility_consultant_assignments" ADD COLUMN "vertical_id" text;
--> statement-breakpoint
UPDATE "facility_consultant_assignments" c
SET "vertical_id" = v.id
FROM "business_verticals" v
WHERE v.code = 'ORTOPEDIA' AND c.vertical_id IS NULL;
--> statement-breakpoint
ALTER TABLE "facility_consultant_assignments" ALTER COLUMN "vertical_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "facility_consultant_assignments" ADD CONSTRAINT "facility_consultant_assignments_vertical_id_business_verticals_id_fk" FOREIGN KEY ("vertical_id") REFERENCES "public"."business_verticals"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "facility_consultant_assignments_vertical_id_idx" ON "facility_consultant_assignments" USING btree ("vertical_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "facility_consultant_assignments_facility_vertical_active_uidx" ON "facility_consultant_assignments" USING btree ("facility_id","vertical_id") WHERE "ended_at" IS NULL;
--> statement-breakpoint

-- 12) Drop territories.sector_id
ALTER TABLE "territories" DROP CONSTRAINT IF EXISTS "territories_sector_id_sectors_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "territories_sector_id_idx";
--> statement-breakpoint
ALTER TABLE "territories" DROP COLUMN IF EXISTS "sector_id";
--> statement-breakpoint

-- 13) cadastro_submissions.vertical_id (nullable; backfill Ortopedia for existing rows)
ALTER TABLE "cadastro_submissions" ADD COLUMN "vertical_id" text;
--> statement-breakpoint
UPDATE "cadastro_submissions" s
SET "vertical_id" = v.id
FROM "business_verticals" v
WHERE v.code = 'ORTOPEDIA' AND s.vertical_id IS NULL;
--> statement-breakpoint
ALTER TABLE "cadastro_submissions" ADD CONSTRAINT "cadastro_submissions_vertical_id_business_verticals_id_fk" FOREIGN KEY ("vertical_id") REFERENCES "public"."business_verticals"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "cadastro_submissions_vertical_id_idx" ON "cadastro_submissions" USING btree ("vertical_id");
--> statement-breakpoint

-- 14) Ensure OPS / MANAGER / REP users have Ortopedia assignment
INSERT INTO "user_vertical_assignments" (
  "id",
  "user_id",
  "vertical_id",
  "manager_id",
  "assigned_by_user_id",
  "created_at",
  "updated_at"
)
SELECT
  'uva_' || u.id,
  u.id,
  v.id,
  NULL,
  NULL,
  now(),
  now()
FROM "users" u
JOIN "roles" r ON r.id = u.role_id
CROSS JOIN "business_verticals" v
WHERE v.code = 'ORTOPEDIA'
  AND r.name IN ('OPS', 'MANAGER', 'REP')
  AND NOT EXISTS (
    SELECT 1
    FROM "user_vertical_assignments" a
    WHERE a.user_id = u.id AND a.vertical_id = v.id
  );
