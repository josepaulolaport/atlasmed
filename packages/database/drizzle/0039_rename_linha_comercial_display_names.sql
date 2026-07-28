-- Display labels for Linha comercial (adjective form).
-- Codes ORTOPEDIA / DERMATOLOGIA unchanged. Clinic specialty nouns stay Ortopedia / Dermatologia.
UPDATE "business_verticals"
SET "name" = 'Ortopédica', "updated_at" = NOW()
WHERE "code" = 'ORTOPEDIA' AND "name" <> 'Ortopédica';
--> statement-breakpoint
UPDATE "business_verticals"
SET "name" = 'Dermatológica', "updated_at" = NOW()
WHERE "code" = 'DERMATOLOGIA' AND "name" <> 'Dermatológica';
