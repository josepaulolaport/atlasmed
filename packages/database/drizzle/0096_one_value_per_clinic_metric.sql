-- Custom migration: spec 0013 §4.6 — one value per clinic per metric.
--
-- Written by hand rather than generated: dropping `month` while adding the
-- `no_other_brands` columns is ambiguous to the generator, which asks whether a
-- column is being renamed. It is not — the month is going away.
--
-- Ordering matters here. Rows are deduplicated *before* the narrower keys are
-- added, so the constraint cannot fail on data that predates the rule.

--> statement-breakpoint
-- ============================================================
-- facility_product_usage: one standing figure per product
-- ============================================================

-- A competitor now carries one figure, so a product with several month rows
-- collapses to its newest. Doing this before the unique key means the key is
-- added against data that already satisfies it.
DELETE FROM facility_product_usage a
USING facility_product_usage b
WHERE a.facility_vertical_profile_id = b.facility_vertical_profile_id
  AND a.definition_id = b.definition_id
  AND a.product_id = b.product_id
  AND (a.month, a.updated_at, a.id) < (b.month, b.updated_at, b.id);
--> statement-breakpoint

-- Zero stops being a quantity (§4.6): "they sell none here" is the
-- no_other_brands claim, which records who said it. Any existing zero row is
-- an anonymous version of that claim and is dropped rather than migrated.
DELETE FROM facility_product_usage WHERE quantity <= 0;
--> statement-breakpoint

ALTER TABLE facility_product_usage
  DROP CONSTRAINT facility_product_usage_profile_definition_product_month_key;
--> statement-breakpoint
ALTER TABLE facility_product_usage
  DROP CONSTRAINT facility_product_usage_month_is_first_of_month;
--> statement-breakpoint
ALTER TABLE facility_product_usage DROP COLUMN month;
--> statement-breakpoint

ALTER TABLE facility_product_usage
  DROP CONSTRAINT facility_product_usage_quantity_non_negative;
--> statement-breakpoint
ALTER TABLE facility_product_usage
  ADD CONSTRAINT facility_product_usage_quantity_positive CHECK (quantity > 0);
--> statement-breakpoint

ALTER TABLE facility_product_usage
  ADD CONSTRAINT facility_product_usage_profile_definition_product_key
  UNIQUE (facility_vertical_profile_id, definition_id, product_id);
--> statement-breakpoint

-- ============================================================
-- facility_metric_snapshots: one row, and the rep's claim on it
-- ============================================================

-- Keep the most recently computed row per (profile, metric). The others are
-- months of a series nothing reads any more.
DELETE FROM facility_metric_snapshots a
USING facility_metric_snapshots b
WHERE a.facility_vertical_profile_id = b.facility_vertical_profile_id
  AND a.definition_id = b.definition_id
  AND (a.month, a.computed_at) < (b.month, b.computed_at);
--> statement-breakpoint

-- `share` is generated from columns this migration changes, so it is dropped
-- before them and rebuilt afterwards with the claim in its definition.
ALTER TABLE facility_metric_snapshots DROP COLUMN share;
--> statement-breakpoint

ALTER TABLE facility_metric_snapshots DROP CONSTRAINT facility_metric_snapshots_pkey;
--> statement-breakpoint
ALTER TABLE facility_metric_snapshots
  DROP CONSTRAINT facility_metric_snapshots_month_is_first_of_month;
--> statement-breakpoint
DROP INDEX IF EXISTS facility_metric_snapshots_month_idx;
--> statement-breakpoint
ALTER TABLE facility_metric_snapshots DROP COLUMN month;
--> statement-breakpoint
ALTER TABLE facility_metric_snapshots
  ADD CONSTRAINT facility_metric_snapshots_pkey
  PRIMARY KEY (facility_vertical_profile_id, definition_id);
--> statement-breakpoint

-- The claim. An input living on a derived row: the recompute writes ours_qty,
-- theirs_qty and computed_at, and never these three.
ALTER TABLE facility_metric_snapshots
  ADD COLUMN no_other_brands boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE facility_metric_snapshots
  ADD COLUMN no_other_brands_set_by_user_id bigint;
--> statement-breakpoint
ALTER TABLE facility_metric_snapshots
  ADD COLUMN no_other_brands_set_at timestamp;
--> statement-breakpoint
ALTER TABLE facility_metric_snapshots
  -- Named explicitly and kept under 63 characters: the derived name was
  -- truncated by Postgres, which is how a constraint ends up under a name the
  -- schema does not know.
  ADD CONSTRAINT facility_metric_snapshots_claim_user_fk
  FOREIGN KEY (no_other_brands_set_by_user_id) REFERENCES users(id) ON DELETE SET NULL;
--> statement-breakpoint

-- "No other brand is sold here" and "here is one they sell" cannot both hold.
ALTER TABLE facility_metric_snapshots
  ADD CONSTRAINT facility_metric_snapshots_no_other_brands_excludes_theirs
  CHECK (NOT no_other_brands OR theirs_qty = 0);
--> statement-breakpoint

-- Rebuilt with the claim: a share exists only for a market we know about —
-- a recorded competitor, or a rep saying there is none — and only when there is
-- something in it to divide. Without the first half an unsurveyed clinic
-- reported 100%.
ALTER TABLE facility_metric_snapshots
  ADD COLUMN share numeric(9, 8) GENERATED ALWAYS AS (
    CASE
      WHEN (no_other_brands OR theirs_qty > 0) AND ours_qty + theirs_qty > 0
      THEN ours_qty / (ours_qty + theirs_qty)
    END
  ) STORED;
--> statement-breakpoint

-- ============================================================
-- invitations: one live invitation per person
-- ============================================================

-- Partial, because the rule is about *live* invitations: revoking or letting one
-- expire must leave the person re-invitable. `lower(email)` matches
-- users_email_lower_uidx, so an invite cannot be keyed differently from the user
-- it creates.
CREATE UNIQUE INDEX invitations_pending_email_uidx
  ON invitations (lower(email))
  WHERE status = 'PENDING' AND email IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX invitations_pending_phone_number_uidx
  ON invitations (phone_number)
  WHERE status = 'PENDING' AND phone_number IS NOT NULL;
