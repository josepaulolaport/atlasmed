-- ADR 0004 D20: only two classification codes when projection API lands.
INSERT INTO "person_facility_classifications" ("code", "name", "is_active", "created_at", "updated_at")
SELECT 'HEALTHCARE_PROFESSIONAL', 'Profissional de saúde', true, now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM "person_facility_classifications" WHERE "code" = 'HEALTHCARE_PROFESSIONAL'
);
--> statement-breakpoint
INSERT INTO "person_facility_classifications" ("code", "name", "is_active", "created_at", "updated_at")
SELECT 'ADMINISTRATIVE_CONTACT', 'Contato administrativo', true, now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM "person_facility_classifications" WHERE "code" = 'ADMINISTRATIVE_CONTACT'
);
