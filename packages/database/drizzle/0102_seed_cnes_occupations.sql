-- Spec 0012 §6: the occupation vocabulary a CNES import writes against.
--
-- `occupations.cnes_id` is the CBO, unique and already populated for the 28
-- rows we had — so this is a data seed, not a schema change. It brings the
-- catalogue up to every CBO CNES actually records at our clinics (66), and
-- shortens the display names, which become chips on a doctor's row.
--
-- **Literal values, never a SELECT from `registry.occupations`.** The registry
-- is populated by the monthly worker; on production it is empty until that
-- first run, so a seed that read from it would insert nothing and report
-- success. These rows have to stand on their own.
--
-- Idempotent both halves: re-running inserts nothing new and rewrites the same
-- names.

--> statement-breakpoint

-- ── Names ────────────────────────────────────────────────────────────────────
--
-- "Medico" is dropped from every title. The chip sits on a doctor's row, so the
-- prefix is noise on 63 of 66 rows and is most of what makes them wide. Accents
-- are added: the existing rows were seeded without them ("Medico Clinico").
--
-- The three non-clinical titles keep enough of their wording to stay
-- distinguishable — a director is not a specialty.

INSERT INTO "occupations" ("cnes_id", "name", "is_health_occupation", "is_regulated", "created_at", "updated_at")
VALUES
  ('131205', 'Diretor de Serviços', true, true, now(), now()),
  ('2231F8', 'Medicina Preventiva', true, true, now(), now()),
  ('2231F9', 'Residente', true, true, now(), now()),
  ('2231G1', 'Cardio Intervencionista', true, true, now(), now()),
  ('225103', 'Infectologista', true, true, now(), now()),
  ('225105', 'Acupunturista', true, true, now(), now()),
  ('225109', 'Nefrologista', true, true, now(), now()),
  ('225110', 'Alergista', true, true, now(), now()),
  ('225115', 'Angiologista', true, true, now(), now()),
  ('225118', 'Nutrólogo', true, true, now(), now()),
  ('225121', 'Oncologista Clínico', true, true, now(), now()),
  ('225122', 'Cancerologista Pediátrico', true, true, now(), now()),
  ('225127', 'Pneumologista', true, true, now(), now()),
  ('225139', 'Sanitarista', true, true, now(), now()),
  ('225142', 'Saúde da Família', true, true, now(), now()),
  ('225145', 'Medicina de Tráfego', true, true, now(), now()),
  ('225148', 'Anatomopatologista', true, true, now(), now()),
  ('225150', 'Intensivista', true, true, now(), now()),
  ('225151', 'Anestesiologista', true, true, now(), now()),
  ('225155', 'Endocrinologista', true, true, now(), now()),
  ('225160', 'Fisiatra', true, true, now(), now()),
  ('225165', 'Gastroenterologista', true, true, now(), now()),
  ('225170', 'Generalista', true, true, now(), now()),
  ('225175', 'Geneticista', true, true, now(), now()),
  ('225180', 'Geriatra', true, true, now(), now()),
  ('225185', 'Hematologista', true, true, now(), now()),
  ('225195', 'Homeopata', true, true, now(), now()),
  ('225203', 'Cirurgião Vascular', true, true, now(), now()),
  ('225210', 'Cirurgião Cardiovascular', true, true, now(), now()),
  ('225215', 'Cirurgião Cabeça e Pescoço', true, true, now(), now()),
  ('225220', 'Cirurgião Digestivo', true, true, now(), now()),
  ('225230', 'Cirurgião Pediátrico', true, true, now(), now()),
  ('225235', 'Cirurgião Plástico', true, true, now(), now()),
  ('225240', 'Cirurgião Torácico', true, true, now(), now()),
  ('225255', 'Mastologista', true, true, now(), now()),
  ('225280', 'Coloproctologista', true, true, now(), now()),
  ('225290', 'Cancerologista Cirúrgico', true, true, now(), now()),
  ('225295', 'Cirurgião da Mão', true, true, now(), now()),
  ('225305', 'Citopatologista', true, true, now(), now()),
  ('225310', 'Endoscopista', true, true, now(), now()),
  ('225315', 'Medicina Nuclear', true, true, now(), now()),
  ('225325', 'Patologista', true, true, now(), now()),
  ('225330', 'Radioterapeuta', true, true, now(), now()),
  ('225335', 'Patologista Clínico', true, true, now(), now()),
  ('225340', 'Hemoterapeuta', true, true, now(), now()),
  ('225350', 'Neurofisiologista', true, true, now(), now()),
  ('225355', 'Radiologia Intervencionista', true, true, now(), now()),
  ('234435', 'Professor', false, false, now(), now())
ON CONFLICT ("cnes_id") DO NOTHING;--> statement-breakpoint

-- ── Rename what we already had ───────────────────────────────────────────────
--
-- Matched on `cnes_id`, never on the old name: the CBO is the identity and the
-- name is the thing being changed. These rows are referenced by
-- `person_facility_occupations`, so renaming is safe — nothing joins on text.
--
-- This is visible outside the import flow, wherever an occupation is already
-- displayed. That is the point: "Medico Clinico" was never a good label.

UPDATE "occupations" SET "name" = 'Clínico', "updated_at" = now() WHERE "cnes_id" = '225125';--> statement-breakpoint
UPDATE "occupations" SET "name" = 'Ortopedista', "updated_at" = now() WHERE "cnes_id" = '225270';--> statement-breakpoint
UPDATE "occupations" SET "name" = 'Gineco-obstetra', "updated_at" = now() WHERE "cnes_id" = '225250';--> statement-breakpoint
UPDATE "occupations" SET "name" = 'Pediatra', "updated_at" = now() WHERE "cnes_id" = '225124';--> statement-breakpoint
UPDATE "occupations" SET "name" = 'Cirurgião Geral', "updated_at" = now() WHERE "cnes_id" = '225225';--> statement-breakpoint
UPDATE "occupations" SET "name" = 'Cardiologista', "updated_at" = now() WHERE "cnes_id" = '225120';--> statement-breakpoint
UPDATE "occupations" SET "name" = 'Radiologista', "updated_at" = now() WHERE "cnes_id" = '225320';--> statement-breakpoint
UPDATE "occupations" SET "name" = 'Urologista', "updated_at" = now() WHERE "cnes_id" = '225285';--> statement-breakpoint
UPDATE "occupations" SET "name" = 'Otorrino', "updated_at" = now() WHERE "cnes_id" = '225275';--> statement-breakpoint
UPDATE "occupations" SET "name" = 'Oftalmologista', "updated_at" = now() WHERE "cnes_id" = '225265';--> statement-breakpoint
UPDATE "occupations" SET "name" = 'Neurologista', "updated_at" = now() WHERE "cnes_id" = '225112';--> statement-breakpoint
UPDATE "occupations" SET "name" = 'Neurocirurgião', "updated_at" = now() WHERE "cnes_id" = '225260';--> statement-breakpoint
UPDATE "occupations" SET "name" = 'Dermatologista', "updated_at" = now() WHERE "cnes_id" = '225135';--> statement-breakpoint
UPDATE "occupations" SET "name" = 'Psiquiatra', "updated_at" = now() WHERE "cnes_id" = '225133';--> statement-breakpoint
UPDATE "occupations" SET "name" = 'Reumatologista', "updated_at" = now() WHERE "cnes_id" = '225136';--> statement-breakpoint
UPDATE "occupations" SET "name" = 'Médico do Trabalho', "updated_at" = now() WHERE "cnes_id" = '225140';--> statement-breakpoint
UPDATE "occupations" SET "name" = 'Família e Comunidade', "updated_at" = now() WHERE "cnes_id" = '225130';--> statement-breakpoint
UPDATE "occupations" SET "name" = 'Hiperbarista', "updated_at" = now() WHERE "cnes_id" = '225345';
