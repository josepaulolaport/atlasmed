-- ADR 0004 §5.5 / Phase 2: minimal council seed so CRM registrations can FK.
INSERT INTO "person_professional_registration_councils" ("code", "name", "is_active", "created_at", "updated_at")
SELECT 'CRM', 'Conselho Regional de Medicina', true, now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM "person_professional_registration_councils" WHERE "code" = 'CRM'
);
