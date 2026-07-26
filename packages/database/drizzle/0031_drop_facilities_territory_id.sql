-- Drop legacy facilities.territory_id after backfilling active profiles.
-- Idempotent: safe if column already removed.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'facilities'
      AND column_name = 'territory_id'
  ) THEN
    UPDATE "facility_vertical_profiles" AS p
    SET "territory_id" = f."territory_id",
        "updated_at" = now()
    FROM "facilities" AS f
    WHERE p."facility_id" = f."id"
      AND p."is_active" = true
      AND p."territory_id" IS NULL
      AND f."territory_id" IS NOT NULL;

    DROP INDEX IF EXISTS "facilities_territory_id_idx";
    ALTER TABLE "facilities" DROP CONSTRAINT IF EXISTS "facilities_territory_id_territories_id_fk";
    ALTER TABLE "facilities" DROP COLUMN "territory_id";
  END IF;
END $$;
