-- Spec 0013 §2.1 — ownership as a database constraint, not application discipline.
--
-- When competitor products lived in their own table, "an order line references a
-- product we sell" was guaranteed by which table the foreign key pointed at.
-- Merging them into `products` (0083) removed that guarantee and left it as
-- prose: `REFERENCES products(id)` now accepts either kind. This puts it back.
--
-- Mechanism: each referencing table carries a generated column holding the
-- ownership it accepts, and a composite foreign key onto `(products.id,
-- ownership)`. The column is GENERATED ALWAYS, so no insert can set it and no
-- default can drift.
--
-- NOTE ON STATEMENT ORDER: `drizzle-kit generate` emitted the foreign keys
-- *before* the unique constraint they reference, which fails with "there is no
-- unique constraint matching given keys". Reordered by hand — the same failure
-- 0081 had. Do not regenerate this file without re-checking the order.

-- ── Guard ───────────────────────────────────────────────────────────────────
-- The constraints below are unenforceable against rows that already violate
-- them, and the raw failure ("violates foreign key constraint") would not say
-- which row or why. Report the counts instead.
DO $$
DECLARE
  bad_order_items bigint;
  bad_equivalence_own bigint;
  bad_equivalence_competitor bigint;
  bad_self_links bigint;
  bad_standards bigint;
BEGIN
  SELECT count(*) INTO bad_order_items
  FROM order_items oi JOIN products p ON p.id = oi.product_id
  WHERE p.ownership <> 'OWN';

  SELECT count(*) INTO bad_equivalence_own
  FROM product_equivalences e JOIN products p ON p.id = e.product_id
  WHERE p.ownership <> 'OWN';

  SELECT count(*) INTO bad_equivalence_competitor
  FROM product_equivalences e JOIN products p ON p.id = e.competitor_product_id
  WHERE p.ownership <> 'COMPETITOR';

  SELECT count(*) INTO bad_self_links
  FROM product_equivalences WHERE product_id = competitor_product_id;

  SELECT count(*) INTO bad_standards
  FROM facility_competitor_product_standards s JOIN products p ON p.id = s.competitor_product_id
  WHERE p.ownership <> 'COMPETITOR';

  IF bad_order_items > 0 OR bad_equivalence_own > 0 OR bad_equivalence_competitor > 0
     OR bad_self_links > 0 OR bad_standards > 0 THEN
    RAISE EXCEPTION
      'Refusing to run 0085: rows already violate the ownership rules. '
      'order_items on a non-OWN product: % · equivalences whose left side is not OWN: % · '
      'equivalences whose right side is not COMPETITOR: % · self-links: % · '
      'competitor standards on a non-COMPETITOR product: %. '
      'Reclassify or delete these rows first — the constraints cannot be added around them.',
      bad_order_items, bad_equivalence_own, bad_equivalence_competitor,
      bad_self_links, bad_standards;
  END IF;
END $$;--> statement-breakpoint

-- ── The referenceable target ────────────────────────────────────────────────
-- Redundant on its own (`id` is already the primary key), but a composite
-- foreign key can only point at a unique constraint. Must exist before any of
-- the foreign keys below.
ALTER TABLE "products" ADD CONSTRAINT "products_id_ownership_key" UNIQUE("id","ownership");--> statement-breakpoint

-- ── Ownership carried by the referencing rows ───────────────────────────────
-- GENERATED ALWAYS … STORED rewrites each table. All are small (12 products,
-- ~thousands of order lines, 0 equivalences).
ALTER TABLE "order_items" ADD COLUMN "product_ownership" "product_ownership" GENERATED ALWAYS AS ('OWN'::product_ownership) STORED NOT NULL;--> statement-breakpoint
ALTER TABLE "product_equivalences" ADD COLUMN "product_ownership" "product_ownership" GENERATED ALWAYS AS ('OWN'::product_ownership) STORED NOT NULL;--> statement-breakpoint
ALTER TABLE "product_equivalences" ADD COLUMN "competitor_ownership" "product_ownership" GENERATED ALWAYS AS ('COMPETITOR'::product_ownership) STORED NOT NULL;--> statement-breakpoint
ALTER TABLE "facility_competitor_product_standards" ADD COLUMN "competitor_ownership" "product_ownership" GENERATED ALWAYS AS ('COMPETITOR'::product_ownership) STORED NOT NULL;--> statement-breakpoint

-- ── The constraints ─────────────────────────────────────────────────────────
-- An order line is something we sold. `product_id` stays nullable and a
-- composite key is MATCH SIMPLE, so a line with no resolved product skips the
-- check — the behaviour we want until P4-4 makes the column NOT NULL.
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_own_fk" FOREIGN KEY ("product_id","product_ownership") REFERENCES "public"."products"("id","ownership") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- An equivalence is directional: ours on the left, theirs on the right.
ALTER TABLE "product_equivalences" ADD CONSTRAINT "product_equivalences_own_side_fk" FOREIGN KEY ("product_id","product_ownership") REFERENCES "public"."products"("id","ownership") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_equivalences" ADD CONSTRAINT "product_equivalences_competitor_side_fk" FOREIGN KEY ("competitor_product_id","competitor_ownership") REFERENCES "public"."products"("id","ownership") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- A clinic's "standard" is what it uses instead of ours.
ALTER TABLE "facility_competitor_product_standards" ADD CONSTRAINT "facility_competitor_standards_competitor_fk" FOREIGN KEY ("competitor_product_id","competitor_ownership") REFERENCES "public"."products"("id","ownership") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint

-- Redundant once the two foreign keys above are in place — a row cannot be both
-- OWN and COMPETITOR — and kept anyway, so "a product cannot be its own
-- competitor" is legible in the schema instead of being derived from two keys.
ALTER TABLE "product_equivalences" ADD CONSTRAINT "product_equivalences_not_self" CHECK ("product_equivalences"."product_id" <> "product_equivalences"."competitor_product_id");
