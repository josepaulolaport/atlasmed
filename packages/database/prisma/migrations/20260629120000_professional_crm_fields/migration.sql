-- Professional CRM fields and facility-professional role enhancements

CREATE TYPE "RelationshipLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

ALTER TABLE "professionals" ADD COLUMN "tax_id" TEXT;
ALTER TABLE "professionals" ADD COLUMN "birth_date" DATE;
ALTER TABLE "professionals" ADD COLUMN "mobile_phone" TEXT;
ALTER TABLE "professionals" ADD COLUMN "landline_phone" TEXT;
ALTER TABLE "professionals" ADD COLUMN "email" TEXT;
ALTER TABLE "professionals" ADD COLUMN "website_url" TEXT;
ALTER TABLE "professionals" ADD COLUMN "image_url" TEXT;
ALTER TABLE "professionals" ADD COLUMN "favorite_team" TEXT;
ALTER TABLE "professionals" ADD COLUMN "favorite_sport" TEXT;
ALTER TABLE "professionals" ADD COLUMN "hobbies" TEXT;
ALTER TABLE "professionals" ADD COLUMN "notes" TEXT;

CREATE INDEX "professionals_tax_id_idx" ON "professionals"("tax_id");

ALTER TABLE "facility_professionals" ADD COLUMN "is_partner" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "facility_professionals" ADD COLUMN "notes" TEXT;

ALTER TABLE "facility_professionals" ADD COLUMN "relationship_level_enum" "RelationshipLevel";

UPDATE "facility_professionals"
SET "relationship_level_enum" = CASE UPPER("relationship_level")
  WHEN 'LOW' THEN 'LOW'::"RelationshipLevel"
  WHEN 'MEDIUM' THEN 'MEDIUM'::"RelationshipLevel"
  WHEN 'HIGH' THEN 'HIGH'::"RelationshipLevel"
  ELSE NULL
END
WHERE "relationship_level" IS NOT NULL;

ALTER TABLE "facility_professionals" DROP COLUMN "relationship_level";
ALTER TABLE "facility_professionals" RENAME COLUMN "relationship_level_enum" TO "relationship_level";
