-- Retire pre-Cadastro shared requirements so they never appear as
-- null tax-type rows in facility Cadastro checklists.
UPDATE "conformity_requirements"
SET
  "is_active" = false,
  "updated_at" = now()
WHERE "slug" IN (
  'alvara-vigilancia-sanitaria',
  'cnes-cadastro',
  'licenca-funcionamento',
  'registro-conselho',
  'responsavel-tecnico'
)
AND ("applies_to_tax_id_type" IS NULL);
