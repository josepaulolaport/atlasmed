-- Spec 0013 §3 — one metric per (product, vertical), not one per product.
--
-- `product_potential_links.product_id` was the primary key, which contradicted
-- `product_verticals` being many-to-many: a product sold in two linhas could
-- carry a metric in one and, silently, none in the other. The link now keys on
-- (product_id, definition_id) and denormalises `vertical_id` so the rule "at
-- most one definition per product per linha" is a schema fact rather than a
-- convention in a use case.
--
-- `vertical_id` is not independent data. The composite foreign key ties it to
-- the definition's own vertical, so a link cannot claim a linha its definition
-- does not have.
--
-- THIS FILE IS HAND-CORRECTED. `drizzle-kit generate` produced three defects:
--   1. it emitted the old FK's *untruncated* 73-char name, but Postgres stored
--      it clipped at 63 ("…_product_potential_definit"), so the DROP would fail
--      (the same defect as 0083);
--   2. it left the old primary-key DROP commented out, so ADD PRIMARY KEY would
--      fail against a table that already has one;
--   3. it added the composite FK *before* the unique constraint that FK
--      references, and added `vertical_id` as NOT NULL with no backfill (the
--      same ordering defect as 0081 and 0085).
-- Re-generating this file will reintroduce all three. Read the SQL.

-- ── Drop what is being replaced ─────────────────────────────────────────────
-- Both names are attempted: the truncated one Postgres actually stored, and the
-- full one in case a future server has a higher identifier limit.
ALTER TABLE "product_potential_links" DROP CONSTRAINT IF EXISTS "product_potential_links_definition_id_product_potential_definit";--> statement-breakpoint
ALTER TABLE "product_potential_links" DROP CONSTRAINT IF EXISTS "product_potential_links_definition_id_product_potential_definitions_id_fk";--> statement-breakpoint
ALTER TABLE "product_potential_links" DROP CONSTRAINT IF EXISTS "product_potential_links_pkey";--> statement-breakpoint

-- ── The referenceable target, before anything references it ─────────────────
ALTER TABLE "product_potential_definitions" ADD CONSTRAINT "product_potential_definitions_id_vertical_id_key" UNIQUE("id","vertical_id");--> statement-breakpoint

-- ── Carry the vertical onto the link ────────────────────────────────────────
-- Added nullable and backfilled rather than NOT NULL outright: the value is
-- derivable from the definition, so a live table repairs itself instead of
-- refusing to migrate.
ALTER TABLE "product_potential_links" ADD COLUMN "vertical_id" bigint;--> statement-breakpoint

UPDATE "product_potential_links" l
   SET "vertical_id" = d."vertical_id"
  FROM "product_potential_definitions" d
 WHERE d."id" = l."definition_id";--> statement-breakpoint

-- A link whose definition no longer exists cannot be repaired here, and the FK
-- below would reject it with a message that names neither the row nor the
-- reason. Fail loudly instead.
DO $$
DECLARE
  orphaned bigint;
BEGIN
  SELECT count(*) INTO orphaned
  FROM product_potential_links WHERE vertical_id IS NULL;

  IF orphaned > 0 THEN
    RAISE EXCEPTION
      'Refusing to run 0086: % product_potential_links row(s) reference a '
      'definition that does not exist, so their vertical cannot be derived. '
      'Delete the orphans or restore the definitions, then re-run.', orphaned;
  END IF;
END $$;--> statement-breakpoint

ALTER TABLE "product_potential_links" ALTER COLUMN "vertical_id" SET NOT NULL;--> statement-breakpoint

-- ── The new keys ────────────────────────────────────────────────────────────
ALTER TABLE "product_potential_links" ADD CONSTRAINT "product_potential_links_pkey" PRIMARY KEY("product_id","definition_id");--> statement-breakpoint
-- No violation is possible: the primary key just dropped was `product_id`
-- alone, so every product held at most one link.
ALTER TABLE "product_potential_links" ADD CONSTRAINT "product_potential_links_product_vertical_key" UNIQUE("product_id","vertical_id");--> statement-breakpoint
ALTER TABLE "product_potential_links" ADD CONSTRAINT "product_potential_links_definition_vertical_fk" FOREIGN KEY ("definition_id","vertical_id") REFERENCES "public"."product_potential_definitions"("id","vertical_id") ON DELETE cascade ON UPDATE no action;
