-- The occupations 0102 did not touch.
--
-- 0102 renamed the CBOs CNES records at our clinics; these ten are the rest of
-- the catalogue — administrative and technical roles nobody imports from CNES.
-- They render as the same chips, so they inherit the same problem: one is 47
-- characters, and three predate accents entirely.
--
-- Its own migration rather than an edit to 0102, which is already applied:
-- rewriting an applied migration is what corrupted a lane's ledger before, and
-- two seed files cost less than a ledger repaired by hand.
--
-- Matched on `cnes_id`, touching `name` only. Nothing here re-points an id, so
-- every existing person_facility_occupations row still resolves to the row it
-- always did.

UPDATE "occupations" SET "name" = 'Recepcionista', "updated_at" = now() WHERE "cnes_id" = '422110';--> statement-breakpoint
UPDATE "occupations" SET "name" = 'Fisioterapeuta', "updated_at" = now() WHERE "cnes_id" = '223635';--> statement-breakpoint
UPDATE "occupations" SET "name" = 'Téc. Imobilização', "updated_at" = now() WHERE "cnes_id" = '322605';--> statement-breakpoint
UPDATE "occupations" SET "name" = 'Téc. Enfermagem', "updated_at" = now() WHERE "cnes_id" = '322205';--> statement-breakpoint
UPDATE "occupations" SET "name" = 'Téc. Ortopedia', "updated_at" = now() WHERE "cnes_id" = '322505';--> statement-breakpoint
UPDATE "occupations" SET "name" = 'Biomédico', "updated_at" = now() WHERE "cnes_id" = '221205';--> statement-breakpoint
-- Kept inclusive rather than shortened to one gender, which is what the
-- original "Secretaria(o) Executiva(o)" was reaching for.
UPDATE "occupations" SET "name" = 'Secretária(o)', "updated_at" = now() WHERE "cnes_id" = '252305';
