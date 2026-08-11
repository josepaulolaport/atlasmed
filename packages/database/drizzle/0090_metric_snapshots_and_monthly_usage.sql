-- Spec 0013 §4.1/§4.4 — the rep's number becomes an observation about a month,
-- and the computed metric gets somewhere to live.
--
-- HAND-CORRECTED. The generator emitted
--
--   ALTER TABLE "facility_product_usage" ADD COLUMN "month" date NOT NULL;
--
-- with no default and no backfill. That succeeds only against an empty table,
-- and fails on any populated one with "column month contains null values". The
-- table is empty in the 2026-08-10 production snapshot, but the endpoint that
-- writes it is live until this deploys, so emptiness is a race, not a fact.
--
-- Unlike 0088, refusing would be the wrong answer here. A timeless "this clinic
-- uses 30 a month" converts faithfully into "in the month it was recorded, 30 a
-- month" — the same number, now dated. Nothing is invented and nothing is lost,
-- so the column is added nullable, backfilled from `updated_at`, and only then
-- made NOT NULL.

-- ── The computed metric ─────────────────────────────────────────────────────
-- A cache, not a source of truth: both inputs carry history, so this table can
-- be truncated and rebuilt and will reproduce itself exactly.
--
-- `total_qty` and `share` are generated rather than written, so no writer can
-- disagree with the columns they derive from. In particular `share` is NULL —
-- never 0 — when nothing is known, which makes "we sell nothing here" and "we
-- have no information" impossible to conflate by accident.
CREATE TABLE "facility_metric_snapshots" (
	"facility_vertical_profile_id" bigint NOT NULL,
	"definition_id" bigint NOT NULL,
	"vertical_id" bigint NOT NULL,
	"month" date NOT NULL,
	"ours_qty" numeric(14, 2) NOT NULL,
	"theirs_qty" numeric(14, 2) NOT NULL,
	"total_qty" numeric(14, 2) GENERATED ALWAYS AS (ours_qty + theirs_qty) STORED NOT NULL,
	"share" numeric(9, 8) GENERATED ALWAYS AS (case when ours_qty + theirs_qty > 0 then ours_qty / (ours_qty + theirs_qty) end) STORED,
	"computed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "facility_metric_snapshots_pkey" PRIMARY KEY("facility_vertical_profile_id","definition_id","month"),
	CONSTRAINT "facility_metric_snapshots_month_is_first_of_month" CHECK ("facility_metric_snapshots"."month" = date_trunc('month', "facility_metric_snapshots"."month"::timestamp)::date),
	CONSTRAINT "facility_metric_snapshots_ours_non_negative" CHECK ("facility_metric_snapshots"."ours_qty" >= 0),
	CONSTRAINT "facility_metric_snapshots_theirs_non_negative" CHECK ("facility_metric_snapshots"."theirs_qty" >= 0)
);
--> statement-breakpoint
-- The same invariant `facility_product_usage` carries: a snapshot cannot pair a
-- profile in one linha with a metric in another.
ALTER TABLE "facility_metric_snapshots" ADD CONSTRAINT "facility_metric_snapshots_profile_vertical_fk" FOREIGN KEY ("facility_vertical_profile_id","vertical_id") REFERENCES "public"."facility_vertical_profiles"("id","vertical_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_metric_snapshots" ADD CONSTRAINT "facility_metric_snapshots_definition_vertical_fk" FOREIGN KEY ("definition_id","vertical_id") REFERENCES "public"."product_potential_definitions"("id","vertical_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "facility_metric_snapshots_month_idx" ON "facility_metric_snapshots" USING btree ("month");--> statement-breakpoint
-- The reconciliation sweep compares this against the inputs' `updated_at`.
CREATE INDEX "facility_metric_snapshots_computed_at_idx" ON "facility_metric_snapshots" USING btree ("computed_at");--> statement-breakpoint

-- ── Usage gains its month ───────────────────────────────────────────────────
-- Nullable first, so existing rows survive the addition.
ALTER TABLE "facility_product_usage" ADD COLUMN "month" date;--> statement-breakpoint

-- Backfill: an existing row is the observation that was current when it was
-- last written, so it belongs to that month. `updated_at` is `timestamp without
-- time zone` holding UTC, so it is interpreted as UTC and then read in São
-- Paulo — the same two-step the numerator uses. Truncating in UTC would file a
-- row written 31 March 22:00 local under April.
UPDATE "facility_product_usage"
   SET "month" = (date_trunc('month', "updated_at" at time zone 'UTC' at time zone 'America/Sao_Paulo'))::date
 WHERE "month" IS NULL;--> statement-breakpoint

ALTER TABLE "facility_product_usage" ALTER COLUMN "month" SET NOT NULL;--> statement-breakpoint

-- Swap the uniqueness. The old three-column key is dropped before the
-- four-column one is added; both happen inside the migration's transaction, and
-- the backfill cannot create a collision because the old constraint already
-- guaranteed one row per (profile, definition, product).
ALTER TABLE "facility_product_usage" DROP CONSTRAINT "facility_product_usage_profile_definition_product_key";--> statement-breakpoint
ALTER TABLE "facility_product_usage" ADD CONSTRAINT "facility_product_usage_profile_definition_product_month_key" UNIQUE("facility_vertical_profile_id","definition_id","product_id","month");--> statement-breakpoint

-- A month is its first day, always — otherwise the same month could be written
-- under 28 different keys and the unique constraint would permit every one.
ALTER TABLE "facility_product_usage" ADD CONSTRAINT "facility_product_usage_month_is_first_of_month" CHECK ("facility_product_usage"."month" = date_trunc('month', "facility_product_usage"."month"::timestamp)::date);--> statement-breakpoint

-- The sweep asks "what usage changed since T".
CREATE INDEX "facility_product_usage_updated_at_idx" ON "facility_product_usage" USING btree ("updated_at");
