-- Spec 0011 §3.3 / ADR 0008 §4 — validity dates, and the requirement catalog
-- that migration 0046 destroyed.
--
-- Two things, deliberately in one migration: the columns are useless without a
-- catalog to hang them on, and the catalog is what makes the cadastro feature
-- non-empty at all.
--
-- BACKGROUND. `conformity_requirements` is empty in production. Migration 0014
-- seeded the five-document catalog; 0046 (the text-id → bigint identity cutover)
-- TRUNCATEd it along with ~50 other tables, and no later migration re-seeded it.
-- The consequence was silent: `findActiveRequirements` returns [], every
-- clinic's checklist serializes `documents: []`, and the whole upload/review
-- pipeline has nothing to operate on. Recovered from the pre-0046 dev database
-- `atlasmed-3`, where all ten rows survived; the five active slugs match
-- REQUIREMENT_SLUG_ORDER in `facility-cadastro.use-cases.ts` exactly.
--
-- The five rows 0015 retired (alvara-vigilancia-sanitaria, cnes-cadastro,
-- licenca-funcionamento, registro-conselho, responsavel-tecnico) are NOT
-- restored. Under ADR 0007 a null `vertical_id` means "applies to every linha",
-- so reviving them would put them in every clinic's checklist — the exact leak
-- 0015 closed.

-- ── Columns ─────────────────────────────────────────────────────────────────
-- Both are safe on a live table: the boolean carries a default so Postgres adds
-- it without a rewrite and without a backfill, and the date is nullable.
ALTER TABLE "conformity_requirements" ADD COLUMN "requires_validity_date" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "submission_documents" ADD COLUMN "valid_until" date;--> statement-breakpoint

-- ── Refuse to seed alongside a different live catalog ────────────────────────
-- Idempotency on slug (below) makes re-running harmless, but it would not catch
-- the dangerous case: an environment where somebody has already defined a
-- *different* active catalog. Seeding into that produces two overlapping sets
-- and a checklist nobody intended. Name what was found rather than failing later
-- on a constraint.
DO $$
DECLARE
  unexpected text;
BEGIN
  SELECT string_agg(slug, ', ' ORDER BY slug) INTO unexpected
  FROM conformity_requirements
  WHERE is_active
    AND slug NOT IN (
      'identidade', 'crm', 'comprovante_endereco', 'carta_cnpj', 'licenca_sanitaria'
    );

  IF unexpected IS NOT NULL THEN
    RAISE EXCEPTION
      'Refusing to run 0089: active conformity_requirements already exist that '
      'are not part of the seeded catalog (%). Seeding would leave two '
      'overlapping catalogs. Deactivate or remove them, then re-run.', unexpected;
  END IF;
END $$;--> statement-breakpoint

-- ── The catalog ─────────────────────────────────────────────────────────────
-- Scoped to Ortopedia, the only linha in production (1443 facility profiles).
--
-- The vertical is looked up by `code`, never hardcoded as id 1. `code` carries
-- the unique constraint and is the key 0024's own seed seeds on. More
-- importantly, a database migrated from empty has NO verticals — 0024 and 0027
-- insert them and 0046 truncates them — so a hardcoded id would violate the
-- foreign key on CI while passing against a production clone. Here, a database
-- with no Ortopedia simply seeds nothing, which is correct: it has no
-- facilities either.
--
-- Limits are omitted on purpose. Every value in the recovered data (10 files,
-- 50 MB each, 200 MB combined, jpeg/png/pdf) equals the column default, so the
-- defaults stay the single source rather than being restated per row.
INSERT INTO "conformity_requirements" (
  "slug",
  "name",
  "description",
  "vertical_id",
  "applies_to_legal_document_type",
  "requires_front_and_back",
  "requires_validity_date",
  "is_active"
)
SELECT
  catalog.slug,
  catalog.name,
  catalog.description,
  v.id,
  catalog.legal_document_type::"public"."facility_legal_document_type",
  catalog.requires_front_and_back,
  catalog.requires_validity_date,
  true
FROM "business_verticals" v
CROSS JOIN (
  VALUES
    -- slug, name, description, legal type, front+back, validity date
    ('identidade',
     'Identidade',
     'Documento de identidade (RG, CNH ou equivalente).',
     'CPF', true, false),
    ('crm',
     'CRM',
     'Carteira ou comprovante de registro no Conselho Regional de Medicina.',
     'CPF', false, false),
    ('comprovante_endereco',
     'Comprovante de Endereço',
     'Pode ser endereço da clínica ou endereço da casa.',
     'CPF', false, false),
    ('carta_cnpj',
     'Cartão de CNPJ',
     'Comprovante de inscrição e situação cadastral do CNPJ (Carta/Cartão CNPJ).',
     'CNPJ', false, false),
    -- The only one that expires: a sanitary licence is renewed periodically, so
    -- the rep enters its validity at submit and the reviewer confirms it on
    -- approval (ADR 0008 §6). A Cartão CNPJ never expires, which is why it is
    -- false above.
    ('licenca_sanitaria',
     'Licença Sanitária',
     'Licença sanitária vigente do estabelecimento.',
     'CNPJ', false, true)
) AS catalog(
  slug, name, description, legal_document_type,
  requires_front_and_back, requires_validity_date
)
WHERE v.code = 'ORTOPEDIA'
ON CONFLICT ("slug") DO NOTHING;--> statement-breakpoint

-- ── Say what happened ───────────────────────────────────────────────────────
-- A seed that quietly inserts nothing reads exactly like a seed that worked.
DO $$
DECLARE
  seeded integer;
BEGIN
  SELECT count(*) INTO seeded FROM conformity_requirements WHERE is_active;

  IF seeded = 0 THEN
    RAISE NOTICE
      '0089: no Ortopedia vertical in this database, so no cadastro '
      'requirements were seeded. Expected on a database migrated from empty; '
      'unexpected against a production clone.';
  ELSE
    RAISE NOTICE '0089: % active cadastro requirement(s) present.', seeded;
  END IF;
END $$;
