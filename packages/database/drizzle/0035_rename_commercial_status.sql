-- Remap commercial_status (REGISTERED reused → must rewrite via text):
--   REGISTERED → UNREGISTERED  (pré-cadastro)
--   ACTIVE     → REGISTERED    (operante)
--   SUSPENDED  → SUSPENDED
--   INACTIVE   → UNREGISTERED  (legacy default = pré-cadastro, not closed)
-- CLOSED exists for true relationship-end going forward.
ALTER TABLE "facility_vertical_profiles" ALTER COLUMN "commercial_status" SET DATA TYPE text;--> statement-breakpoint
UPDATE "facility_vertical_profiles"
SET "commercial_status" = CASE "commercial_status"
  WHEN 'REGISTERED' THEN 'UNREGISTERED'
  WHEN 'ACTIVE' THEN 'REGISTERED'
  WHEN 'SUSPENDED' THEN 'SUSPENDED'
  WHEN 'INACTIVE' THEN 'UNREGISTERED'
  WHEN 'UNREGISTERED' THEN 'UNREGISTERED'
  WHEN 'CLOSED' THEN 'UNREGISTERED'
  ELSE "commercial_status"
END;--> statement-breakpoint
DROP TYPE "public"."commercial_status";--> statement-breakpoint
CREATE TYPE "public"."commercial_status" AS ENUM('UNREGISTERED', 'REGISTERED', 'SUSPENDED', 'CLOSED');--> statement-breakpoint
ALTER TABLE "facility_vertical_profiles" ALTER COLUMN "commercial_status" SET DATA TYPE "public"."commercial_status" USING "commercial_status"::"public"."commercial_status";
