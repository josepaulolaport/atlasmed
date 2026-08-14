-- Spec 0015 §4.5 — the registry/público município gap is the Distrito Federal.
--
-- Migration 0110 assumed the 33 municípios CNES holds and `public` does not were
-- real municípios missing from our base, and the import flow created them on
-- demand. Measured, they are nothing of the kind:
--
--   * 31 are Brasília's **regiões administrativas** — Taguatinga, Ceilândia,
--     Gama, Asa Sul, Lago Norte. CNES gives each its own `CO_MUNICIPIO`; IBGE
--     does not. The DF is one município, Brasília, IBGE 5300108 / CNES 530010.
--   * 2 are Ministry internal codes with no establishment at all: `999999 SAS`
--     and `222222 DRAC/CGSOS`.
--
-- 5 571 público + 31 + 2 = 5 604 registry, exactly. There is no município CNES
-- knows and we do not, so nothing should ever be created from this gap. Creating
-- them also invented an `ibge_id` from the 6-digit CNES code, which is the IBGE
-- code *without* its check digit — and that digit is not derivable: it is a
-- modulo-11 checksum with nine real exceptions (Ponto Chique, Coronel Barros,
-- Quixaba and six others), so 9 of 5 571 would be silently wrong.
--
-- **Bridge by code, never by name.** Several RAs share a name with a real
-- município in another state — Taguatinga (Tocantins), Planaltina (Goiás),
-- Sobradinho (Bahia/RS), Cruzeiro (SP), Guará (SP). A name-based match would
-- file 29 Brasília clinics ~700 km away, in the wrong UF and the wrong territory.

-- ── 1. `atlasmed_id` is many-to-one, and the index has to admit it ───────────
--
-- 31 registry rows legitimately point at one público município. The unique index
-- asserted a bijection the domain does not have. Nothing reads this column as a
-- reverse lookup — every caller goes registry → `atlasmed_id` — so relaxing it
-- costs nothing and stops the bridge below from failing on the 2nd DF row.

DROP INDEX IF EXISTS "registry"."registry_municipalities_atlasmed_id_uidx";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "registry_municipalities_atlasmed_id_idx" ON "registry"."municipalities" USING btree ("atlasmed_id") WHERE "registry"."municipalities"."atlasmed_id" IS NOT NULL;--> statement-breakpoint

-- ── 2. Every DF locality resolves to Brasília ────────────────────────────────
--
-- Guarded on `atlasmed_id IS NULL` so a bridge set by hand is never overwritten
-- (invariant 4), and on the `53` prefix so the two Ministry codes stay unbridged
-- — they carry no establishment, and an import naming one should fail loudly
-- rather than land a clinic in a placeholder.
--
-- Idempotent, and a no-op on an environment where the registry is not yet loaded
-- (a fresh database has `registry.municipalities` empty; the loader carries the
-- same bridge and applies it on every run).

DO $$
DECLARE
  brasilia_id integer;
  bridged_n   integer := 0;
  orphan_n    integer := 0;
BEGIN
  SELECT id INTO brasilia_id FROM public.municipalities WHERE cnes_code = '530010';

  IF brasilia_id IS NULL THEN
    RAISE NOTICE
      'Brasília (CNES 530010) is not in public.municipalities — skipping the DF '
      'bridge. Expected only on a database with no município base loaded.';
    RETURN;
  END IF;

  UPDATE registry.municipalities r
     SET atlasmed_id = brasilia_id, updated_at = now()
   WHERE r.state_cnes_id = 'DF'
     AND r.cnes_id LIKE '53%'
     AND r.atlasmed_id IS NULL;
  GET DIAGNOSTICS bridged_n = ROW_COUNT;

  SELECT count(*) INTO orphan_n
    FROM registry.municipalities r
   WHERE r.atlasmed_id IS NULL;

  RAISE NOTICE
    'DF bridge: % locality(ies) resolved to Brasília (id %). % município(s) remain '
    'unbridged — expected to be the Ministry codes 999999/222222 only.',
    bridged_n, brasilia_id, orphan_n;
END $$;
