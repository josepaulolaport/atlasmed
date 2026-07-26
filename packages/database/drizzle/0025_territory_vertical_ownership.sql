-- Custom SQL migration file, put your code below! --
-- Territory × vertical ownership (P1): per-vertical territory rows + profile membership.

ALTER TABLE "territories" DROP CONSTRAINT IF EXISTS "territories_code_unique";
--> statement-breakpoint
DROP INDEX IF EXISTS "territories_slug_uidx";
--> statement-breakpoint
ALTER TABLE "territories" ADD COLUMN IF NOT EXISTS "vertical_id" text;
--> statement-breakpoint
UPDATE "territories" AS t
SET "vertical_id" = bv.id
FROM "business_verticals" AS bv
WHERE t."vertical_id" IS NULL AND bv."code" = 'ORTOPEDIA';
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "territories" WHERE "vertical_id" IS NULL) THEN
    RAISE EXCEPTION 'territories.vertical_id backfill failed: rows without ORTOPEDIA vertical';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "territories" ALTER COLUMN "vertical_id" SET NOT NULL;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'territories_vertical_id_business_verticals_id_fk'
  ) THEN
    ALTER TABLE "territories"
      ADD CONSTRAINT "territories_vertical_id_business_verticals_id_fk"
      FOREIGN KEY ("vertical_id") REFERENCES "public"."business_verticals"("id")
      ON DELETE restrict ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "territories_vertical_id_slug_uidx"
  ON "territories" USING btree ("vertical_id","slug");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "territories_vertical_id_code_uidx"
  ON "territories" USING btree ("vertical_id","code");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "territories_vertical_id_idx"
  ON "territories" USING btree ("vertical_id");
--> statement-breakpoint
ALTER TABLE "facility_vertical_profiles" ADD COLUMN IF NOT EXISTS "territory_id" text;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'facility_vertical_profiles_territory_id_territories_id_fk'
  ) THEN
    ALTER TABLE "facility_vertical_profiles"
      ADD CONSTRAINT "facility_vertical_profiles_territory_id_territories_id_fk"
      FOREIGN KEY ("territory_id") REFERENCES "public"."territories"("id")
      ON DELETE set null ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "facility_vertical_profiles_territory_id_idx"
  ON "facility_vertical_profiles" USING btree ("territory_id");
--> statement-breakpoint
UPDATE "facility_vertical_profiles" AS p
SET "territory_id" = f."territory_id"
FROM "facilities" AS f
WHERE p."facility_id" = f.id
  AND p."territory_id" IS NULL
  AND f."territory_id" IS NOT NULL
  AND p."vertical_id" = (
    SELECT id FROM "business_verticals" WHERE "code" = 'ORTOPEDIA' LIMIT 1
  );
