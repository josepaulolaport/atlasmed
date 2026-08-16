-- Sample CNES registry rows, so "Buscar no CNES" has something to offer.
--
-- A local database has an empty `registry.*` — the real content comes from the
-- CNES ingestion run, which nobody wants to execute to click through an import.
-- These rows make the import wizard reachable and exercise the cases that
-- actually differ:
--
--   * with coordinates    → the location card opens on a pin
--   * without coordinates → `requiresLocation`, and the "sem território" note
--   * without a CNPJ      → the ~19 % of establishments CNES has no document for
--
-- Everything here is synthetic. The CNES ids are in a 9xxxxxx range the real
-- registry does not use, the CNPJs are made-up numbers that merely carry valid
-- check digits so no validator trips on them, and the coordinates are rough
-- neighbourhood centres rather than surveyed positions — the point is to have
-- somewhere for the map to open, not to describe a real building.
--
-- Idempotent: re-running updates the same rows. Safe on a dev database; not
-- meant for anything else.
--
--   psql "$DATABASE_URL" -f packages/database/scripts/seed-cnes-registry-sample.sql

begin;

-- `rs.cnes_id` is what the UI shows as the state abbreviation, so it holds "RJ"
-- rather than the numeric IBGE code. atlasmed_id links to the app's own row.
insert into registry.states (cnes_id, name, atlasmed_id)
values ('RJ', 'Rio de Janeiro', 19)
on conflict (cnes_id) do update
  set name = excluded.name,
      atlasmed_id = excluded.atlasmed_id;

insert into registry.municipalities (cnes_id, name, state_cnes_id, atlasmed_id)
values ('330455', 'Rio de Janeiro', 'RJ', 3662)
on conflict (cnes_id) do update
  set name = excluded.name,
      state_cnes_id = excluded.state_cnes_id,
      atlasmed_id = excluded.atlasmed_id;

-- unit_type_code values must be ones registry.unit_types maps to an atlasmed_id,
-- or the row is not offerable at all:
--   36 = Clinica/Centro de Especialidade, 22 = Consultorio Isolado,
--   05 = Hospital Geral, 39 = SADT Isolado
insert into registry.facilities (
  cnes_id, legal_name, trade_name,
  tax_id_cnpj, legal_person_type, maintainer_tax_id,
  street_address, street_number, neighborhood, postal_code,
  municipality_cnes_id, phone_number, email,
  latitude, longitude,
  unit_type_code, deactivation_reason_code, atlasmed_id
)
values
  -- Has coordinates: the card opens on a pin, and "Mover pino" re-derives the
  -- address from wherever it is dropped.
  (
    '9900101',
    'CLINICA ORTOPEDICA IPANEMA LTDA',
    'Clinica Ortopedica Ipanema',
    '19000001000164', '3', null,
    'Rua Visconde de Piraja', '550', 'Ipanema', '22410-002',
    '330455', '(21) 2540-0101', 'contato@ortoipanema.exemplo.br',
    -22.98410, -43.20140,
    '36', null, null
  ),
  -- No coordinates: requiresLocation, so the wizard shows the warning and
  -- "Usar endereço" is the fast way out of it.
  (
    '9900102',
    'CENTRO DE TRAUMATOLOGIA BOTAFOGO LTDA',
    'Centro de Traumatologia Botafogo',
    '19000002000109', '3', null,
    'Rua Voluntarios da Patria', '445', 'Botafogo', '22270-000',
    '330455', '(21) 2266-0202', 'contato@traumabotafogo.exemplo.br',
    null, null,
    '36', null, null
  ),
  -- No document at all, and no coordinates. Both blanks are the point.
  (
    '9900103',
    'POLICLINICA MUNICIPAL DA BARRA',
    'Policlinica Municipal da Barra',
    null, null, '19000003000153',
    'Avenida das Americas', '700', 'Barra da Tijuca', '22640-100',
    '330455', '(21) 3325-0303', null,
    null, null,
    '04', null, null
  ),
  -- A consultório with coordinates but no email, so the contact fields are not
  -- uniformly filled.
  (
    '9900104',
    'CONSULTORIO DR PAULO MENDES',
    'Consultorio Dr Paulo Mendes',
    '19000004000106', '3', null,
    'Avenida Nossa Senhora de Copacabana', '1018', 'Copacabana', '22060-002',
    '330455', '(21) 2255-0404', null,
    -22.97120, -43.18580,
    '22', null, null
  ),
  -- Deactivated: must never appear in the offer list. Here so that staying
  -- hidden is observable rather than assumed.
  (
    '9900105',
    'CLINICA ENCERRADA LARANJEIRAS LTDA',
    'Clinica Encerrada Laranjeiras',
    null, '3', null,
    'Rua das Laranjeiras', '120', 'Laranjeiras', '22240-003',
    '330455', null, null,
    null, null,
    '36', '01', null
  )
on conflict (cnes_id) do update
  set legal_name = excluded.legal_name,
      trade_name = excluded.trade_name,
      tax_id_cnpj = excluded.tax_id_cnpj,
      legal_person_type = excluded.legal_person_type,
      maintainer_tax_id = excluded.maintainer_tax_id,
      street_address = excluded.street_address,
      street_number = excluded.street_number,
      neighborhood = excluded.neighborhood,
      postal_code = excluded.postal_code,
      municipality_cnes_id = excluded.municipality_cnes_id,
      phone_number = excluded.phone_number,
      email = excluded.email,
      latitude = excluded.latitude,
      longitude = excluded.longitude,
      unit_type_code = excluded.unit_type_code,
      deactivation_reason_code = excluded.deactivation_reason_code,
      updated_at = now();

commit;
