-- Backfill null tax id types to PJ, reset Cadastro/commercial readiness,
-- then enforce NOT NULL + default PJ on facilities.tax_id_type.

UPDATE "facilities"
SET "tax_id_type" = 'PJ'
WHERE "tax_id_type" IS NULL;

UPDATE "facilities"
SET "conformity_status" = 'INCOMPLETE';

UPDATE "facilities"
SET "commercial_status" = 'INACTIVE';

ALTER TABLE "facilities"
ALTER COLUMN "tax_id_type" SET DEFAULT 'PJ';

ALTER TABLE "facilities"
ALTER COLUMN "tax_id_type" SET NOT NULL;
