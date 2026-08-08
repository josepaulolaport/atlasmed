-- Re-seed catalogs after id-PK reshape (0053/0054 targeted code-PK shape).
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
--> statement-breakpoint
INSERT INTO "person_facility_roles" ("code", "name", "is_active", "created_at", "updated_at")
SELECT 'PRESCRIBER', 'Prescritor', true, now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM "person_facility_roles" WHERE "code" = 'PRESCRIBER'
);
--> statement-breakpoint
INSERT INTO "person_facility_roles" ("code", "name", "is_active", "created_at", "updated_at")
SELECT 'BUYER', 'Comprador', true, now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM "person_facility_roles" WHERE "code" = 'BUYER'
);
--> statement-breakpoint
INSERT INTO "person_facility_roles" ("code", "name", "is_active", "created_at", "updated_at")
SELECT 'DECISION_MAKER', 'Decisor', true, now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM "person_facility_roles" WHERE "code" = 'DECISION_MAKER'
);
--> statement-breakpoint
INSERT INTO "person_facility_roles" ("code", "name", "is_active", "created_at", "updated_at")
SELECT 'PARTNER', 'Parceiro', true, now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM "person_facility_roles" WHERE "code" = 'PARTNER'
);
--> statement-breakpoint
INSERT INTO "person_facility_roles" ("code", "name", "is_active", "created_at", "updated_at")
SELECT 'ADMINISTRATOR', 'Administrador', true, now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM "person_facility_roles" WHERE "code" = 'ADMINISTRATOR'
);
--> statement-breakpoint
INSERT INTO "person_facility_roles" ("code", "name", "is_active", "created_at", "updated_at")
SELECT 'BILLER', 'Faturamento', true, now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM "person_facility_roles" WHERE "code" = 'BILLER'
);
--> statement-breakpoint
INSERT INTO "person_facility_roles" ("code", "name", "is_active", "created_at", "updated_at")
SELECT 'SECRETARY', 'Secretário(a)', true, now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM "person_facility_roles" WHERE "code" = 'SECRETARY'
);
