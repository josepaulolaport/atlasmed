-- Spec 0015 — the schema the national CNES import needs.
--
-- Four things, in order:
--
--   1. Registry catalogues (unit types, subtypes, deactivation reasons), where
--      `unit_types.atlasmed_id` doubles as the **import allowlist** (§3.2).
--   2. New columns on `registry.facilities` — coordinates, subtype, legal person
--      type, maintainer CNPJ, and the managing município split away from the
--      establishment's own (§4.2, §4.4).
--   3. Staging tables for the national workload files (§6.7), so importing a
--      clinic derives its roster from a query rather than a background job.
--   4. Backfills: the geography bridge, and the catalogues seeded from `public`
--      so the allowlist works before the next monthly run.
--
-- Nothing here is destructive except dropping two columns that are empty on
-- every row, and that drop refuses rather than assumes.

-- ── 1. Registry catalogues ───────────────────────────────────────────────────

CREATE TABLE "registry"."unit_types" (
	"cnes_id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"atlasmed_id" bigint,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "registry"."unit_subtypes" (
	"unit_type_cnes_id" text NOT NULL,
	"cnes_id" text NOT NULL,
	"name" text NOT NULL,
	"atlasmed_id" bigint,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "registry_unit_subtypes_pkey" PRIMARY KEY("unit_type_cnes_id","cnes_id")
);
--> statement-breakpoint
CREATE TABLE "registry"."deactivation_reasons" (
	"cnes_id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"atlasmed_id" bigint,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "registry"."unit_subtypes" ADD CONSTRAINT "registry_unit_subtypes_unit_type_cnes_id_fk" FOREIGN KEY ("unit_type_cnes_id") REFERENCES "registry"."unit_types"("cnes_id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "registry_unit_types_atlasmed_id_uidx" ON "registry"."unit_types" USING btree ("atlasmed_id") WHERE "registry"."unit_types"."atlasmed_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "registry_unit_subtypes_atlasmed_id_uidx" ON "registry"."unit_subtypes" USING btree ("atlasmed_id") WHERE "registry"."unit_subtypes"."atlasmed_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "registry_deactivation_reasons_atlasmed_id_uidx" ON "registry"."deactivation_reasons" USING btree ("atlasmed_id") WHERE "registry"."deactivation_reasons"."atlasmed_id" IS NOT NULL;--> statement-breakpoint

-- ── 2. registry.facilities — new columns ─────────────────────────────────────

ALTER TABLE "registry"."facilities" ADD COLUMN "managing_municipality_cnes_id" text;--> statement-breakpoint
ALTER TABLE "registry"."facilities" ADD COLUMN "unit_subtype_code" text;--> statement-breakpoint
ALTER TABLE "registry"."facilities" ADD COLUMN "latitude" numeric;--> statement-breakpoint
ALTER TABLE "registry"."facilities" ADD COLUMN "longitude" numeric;--> statement-breakpoint
ALTER TABLE "registry"."facilities" ADD COLUMN "legal_person_type" text;--> statement-breakpoint
ALTER TABLE "registry"."facilities" ADD COLUMN "maintainer_tax_id" text;--> statement-breakpoint
CREATE INDEX "registry_facilities_offerable_idx" ON "registry"."facilities" USING btree ("unit_type_code") WHERE "registry"."facilities"."deactivation_reason_code" IS NULL;--> statement-breakpoint

/*
 * `unit_type_name` and `unit_subtype_name` were denormalised copies the loader
 * never filled — empty on all 1 423 rows — and the catalogues above now carry
 * the names properly. Dropping a column is irreversible, so this refuses rather
 * than assuming the emptiness still holds.
 */
DO $$
DECLARE
  filled_n integer;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'registry' AND table_name = 'facilities'
       AND column_name IN ('unit_type_name', 'unit_subtype_name')
  ) THEN
    EXECUTE 'SELECT count(*) FROM registry.facilities
              WHERE unit_type_name IS NOT NULL OR unit_subtype_name IS NOT NULL'
       INTO filled_n;

    IF filled_n > 0 THEN
      RAISE EXCEPTION
        '% registry.facilities row(s) carry a unit_type_name or unit_subtype_name. '
        'These columns were expected to be empty everywhere; something now writes them, '
        'so dropping would lose data. Investigate before re-running.', filled_n;
    END IF;

    ALTER TABLE registry.facilities DROP COLUMN unit_type_name;
    ALTER TABLE registry.facilities DROP COLUMN unit_subtype_name;
  END IF;
END $$;
--> statement-breakpoint

-- ── 3. Staging — the national workload rows ──────────────────────────────────

CREATE TABLE "ingestion"."carga_staging" (
	"reference_year" integer NOT NULL,
	"reference_month" integer NOT NULL,
	"unit_code" text NOT NULL,
	"professional_sus_id" text NOT NULL,
	"council_code" text NOT NULL,
	"registration_uf" text NOT NULL,
	"registration_number" text NOT NULL,
	"occupation_code" text
);
--> statement-breakpoint
CREATE TABLE "ingestion"."professional_staging" (
	"reference_year" integer NOT NULL,
	"reference_month" integer NOT NULL,
	"professional_sus_id" text NOT NULL,
	"name" text NOT NULL,
	"cns" text,
	CONSTRAINT "cnes_professional_staging_pkey" PRIMARY KEY("reference_year","reference_month","professional_sus_id")
);
--> statement-breakpoint
CREATE INDEX "cnes_carga_staging_reference_unit_idx" ON "ingestion"."carga_staging" USING btree ("reference_year","reference_month","unit_code");--> statement-breakpoint
CREATE INDEX "cnes_carga_staging_reference_professional_idx" ON "ingestion"."carga_staging" USING btree ("reference_year","reference_month","professional_sus_id");--> statement-breakpoint

-- ── 4. Backfills ─────────────────────────────────────────────────────────────

/*
 * The geography bridge (§4.5). Only the registry-side pointer was ever missing;
 * both sides already hold what they need to be matched.
 *
 * **The two levels join on different keys, and it is not a mistake.** Municípios
 * match on `cnes_code` — the IBGE code, populated on 5 571 of 5 571 and needing
 * no arithmetic (an earlier draft proposed truncating the check digit, which
 * would have mismatched everything). States do not: `registry.states.cnes_id`
 * holds the **sigla** from `tbEstado.CO_SIGLA` (`AC`, `SP`), while
 * `public.states.cnes_code` holds the numeric code (`12`, `35`). Joining states
 * on `cnes_code` matches zero rows — measured, after this migration first did
 * exactly that. The abbreviation matches 27 of 27, with no case divergence.
 *
 * Guarded on `atlasmed_id IS NULL` so a bridge somebody set by hand is never
 * overwritten (invariant 4: the loader never clears an atlasmed_id, and neither
 * does this).
 */
DO $$
DECLARE
  states_n integer := 0;
  munis_n  integer := 0;
BEGIN
  UPDATE registry.states r
     SET atlasmed_id = s.id, updated_at = now()
    FROM public.states s
   WHERE s.abbreviation = r.cnes_id
     AND r.atlasmed_id IS NULL;
  GET DIAGNOSTICS states_n = ROW_COUNT;

  UPDATE registry.municipalities r
     SET atlasmed_id = m.id, updated_at = now()
    FROM public.municipalities m
   WHERE m.cnes_code IS NOT NULL
     AND m.cnes_code = r.cnes_id
     AND r.atlasmed_id IS NULL;
  GET DIAGNOSTICS munis_n = ROW_COUNT;

  RAISE NOTICE 'Geography bridge: % state(s), % município(s).', states_n, munis_n;
END $$;
--> statement-breakpoint

/*
 * Seed the registry catalogues from `public`, and set the import allowlist.
 *
 * Seeding from `public` rather than waiting for the next CNES load is safe
 * because the two already agree exactly — 39 unit types, 91 subtypes and 14
 * deactivation reasons, identical code sets (§3.1) — and it means the allowlist
 * is in force from the moment this migration lands rather than a month later.
 * The loader upserts names from CNES afterwards and will find them unchanged.
 *
 * `unit_types.atlasmed_id` carries a second meaning its siblings do not: it is
 * the decision to import establishments of that kind (§3.2). Subtypes and
 * deactivation reasons bridge every row, because they classify a facility we
 * have already decided to import rather than deciding anything themselves.
 */
INSERT INTO registry.unit_types (cnes_id, name, atlasmed_id)
SELECT lpad(btrim(t.cnes_id), 2, '0'),
       t.name,
       /*
        * Places a rep physically visits to sell. Excludes pharmacies, warehouses,
        * regulation and mobile units (no fixed address), public primary care, and
        * — on measured evidence rather than intuition — cooperativas and centrais
        * de gestão, which share a CNPJ with no clinical establishment and account
        * for none of our 1 131 orders. 77 Home Care and 79 Oficina Ortopédica are
        * excluded too: we sell intra-articular viscosupplementation, injected by a
        * physician in a clinic.
        *
        * Widening this later is one UPDATE with no deploy — which is the reason
        * the allowlist lives on the bridge at all.
        */
       CASE WHEN lpad(btrim(t.cnes_id), 2, '0') IN
                 ('22','36','39','04','05','73','62','07','15','20','21')
            THEN t.id END
  FROM public.unit_types t
ON CONFLICT (cnes_id) DO NOTHING;
--> statement-breakpoint
INSERT INTO registry.unit_subtypes (unit_type_cnes_id, cnes_id, name, atlasmed_id)
SELECT lpad(btrim(t.cnes_id), 2, '0'), btrim(s.cnes_id), s.name, s.id
  FROM public.unit_subtypes s
  JOIN public.unit_types t ON t.id = s.unit_type_id
 WHERE EXISTS (
   SELECT 1 FROM registry.unit_types r WHERE r.cnes_id = lpad(btrim(t.cnes_id), 2, '0')
 )
ON CONFLICT ON CONSTRAINT registry_unit_subtypes_pkey DO NOTHING;
--> statement-breakpoint
/*
 * `public.deactivation_reasons` calls the label `description` where its sibling
 * catalogues call it `name`. The registry keeps `name` throughout — matching one
 * outlier with another would be worse than mapping here.
 */
INSERT INTO registry.deactivation_reasons (cnes_id, name, atlasmed_id)
SELECT btrim(d.cnes_id), d.description, d.id
  FROM public.deactivation_reasons d
ON CONFLICT (cnes_id) DO NOTHING;
--> statement-breakpoint

DO $$
DECLARE
  types_n integer;
  allowed_n integer;
  subtypes_n integer;
  reasons_n integer;
  public_types_n integer;
BEGIN
  SELECT count(*), count(atlasmed_id) INTO types_n, allowed_n FROM registry.unit_types;
  SELECT count(*) INTO subtypes_n FROM registry.unit_subtypes;
  SELECT count(*) INTO reasons_n FROM registry.deactivation_reasons;

  SELECT count(*) INTO public_types_n FROM public.unit_types;

  RAISE NOTICE 'Registry catalogues: % unit types (% importable), % subtypes, % deactivation reasons.',
    types_n, allowed_n, subtypes_n, reasons_n;

  /*
   * A fresh environment legitimately has empty catalogues — `public.unit_types`
   * is populated by the CNES load, not by a seed — so there is nothing here to
   * mirror and nothing to allowlist yet. That is a state to report, not to fail
   * on; the loader bootstraps the allowlist on its first run (spec 0015 §3.2).
   *
   * The failure worth catching is the other one: catalogues that *are* populated
   * and still produced no importable type. That means the allowlisted codes
   * matched nothing, and the import surface would offer an empty list forever
   * while looking perfectly healthy.
   */
  IF public_types_n = 0 THEN
    RAISE NOTICE
      'public.unit_types is empty — fresh environment. Catalogues and the import '
      'allowlist arrive with the first CNES load.';
  ELSIF allowed_n = 0 THEN
    RAISE EXCEPTION
      'No unit type was marked importable, but public.unit_types has % row(s). The codes this '
      'migration allowlists matched none of them, so nothing could ever be imported.', public_types_n;
  END IF;
END $$;
