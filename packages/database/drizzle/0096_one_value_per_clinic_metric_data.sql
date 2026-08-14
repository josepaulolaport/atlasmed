-- Custom migration: spec 0013 §4.6 — one value per clinic per metric.
--
-- **Data only.** The DDL is the next migration, generated from the schema.
-- The split is deliberate: `generate --custom` copies the previous meta
-- snapshot rather than computing a new one, so a custom migration that also
-- changed the schema would leave Drizzle's model a migration behind reality —
-- and the next `generate` would emit the whole change again.
--
-- This runs first, which is the point. Both tables are about to gain narrower
-- keys, and rows that predate the rule would fail them. They are collapsed
-- here, while `month` still exists to collapse them by.

--> statement-breakpoint
-- A competitor now carries one standing figure, so a product with several month
-- rows collapses to its newest.
DELETE FROM facility_product_usage a
USING facility_product_usage b
WHERE a.facility_vertical_profile_id = b.facility_vertical_profile_id
  AND a.definition_id = b.definition_id
  AND a.product_id = b.product_id
  AND (a.month, a.updated_at, a.id) < (b.month, b.updated_at, b.id);
--> statement-breakpoint

-- Zero stops being a quantity (§4.6): "they sell none here" is the
-- no_other_brands claim, which is dated. Any existing zero row is an undated
-- version of that claim and is dropped rather than migrated.
DELETE FROM facility_product_usage WHERE quantity <= 0;
--> statement-breakpoint

-- Keep the most recently computed row per (profile, metric). The others are
-- months of a series nothing reads any more.
DELETE FROM facility_metric_snapshots a
USING facility_metric_snapshots b
WHERE a.facility_vertical_profile_id = b.facility_vertical_profile_id
  AND a.definition_id = b.definition_id
  AND (a.month, a.computed_at) < (b.month, b.computed_at);
--> statement-breakpoint

-- A claim cannot coexist with a competitor row, and the DDL that follows adds a
-- check saying so. Nothing sets the claim yet — the column does not exist — so
-- there is nothing to reconcile here; this comment marks that the ordering was
-- considered rather than overlooked.
SELECT 1;
