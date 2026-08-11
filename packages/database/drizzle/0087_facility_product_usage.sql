-- `facility_product_usage` — the market denominator becomes observed, not guessed.
--
-- STATEMENT ORDER IS HAND-CORRECTED. The generator emitted this file with two
-- ordering faults, both of which fail on a real database:
--
--   1. It added `facility_product_usage_profile_vertical_fk` *before* creating
--      the `facility_vertical_profiles (id, vertical_id)` unique constraint that
--      foreign key references — "there is no unique constraint matching given
--      keys for referenced table". That ADD CONSTRAINT now comes first.
--
--   2. It emitted three bare `DROP INDEX` statements for composite foreign-key
--      targets while the foreign keys that depend on them were still in place —
--      "cannot drop index … because other objects depend on it". Each of those
--      three now takes four statements: drop the FK, drop the index, add the
--      constraint under the same name, re-add the FK.
--
-- It also cannot express the column-specific `ON DELETE SET NULL (district_id)`
-- that production already carries; see the note further down. Both re-added
-- foreign keys below restore the original definition verbatim, taken from
-- `pg_get_constraintdef` against the production snapshot.

-- ── 1. Unique constraint that facility_product_usage's profile FK targets ────
-- Redundant beside the primary key, but a composite foreign key can only
-- reference a unique constraint, never a unique index.
ALTER TABLE "facility_vertical_profiles" ADD CONSTRAINT "facility_vertical_profiles_id_vertical_id_key" UNIQUE("id","vertical_id");--> statement-breakpoint

-- ── 2. Geography: composite FK targets become UNIQUE CONSTRAINTS ─────────────
-- Postgres accepts a unique index as a foreign-key target, so these three have
-- always been correct at runtime and no row changes meaning. But `drizzle-kit
-- push` emits every constraint before any index, so a foreign key referencing a
-- unique *index* is created while its target does not yet exist. That made
-- `db:push` unusable against this schema for every lane and every developer,
-- with an error naming nothing about the real cause. The three affected:
--
--   facilities    -> municipalities (id, state_id)
--   neighborhoods -> districts      (id, municipality_id)
--   neighborhoods -> subdistricts   (id, district_id)
--
-- Verified against a clone carrying 5,571 municipalities and 10,698 districts.

-- municipalities (id, state_id)
ALTER TABLE "facilities" DROP CONSTRAINT "facilities_municipality_state_fk";--> statement-breakpoint
DROP INDEX "municipalities_id_state_id_uidx";--> statement-breakpoint
ALTER TABLE "municipalities" ADD CONSTRAINT "municipalities_id_state_id_uidx" UNIQUE("id","state_id");--> statement-breakpoint
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_municipality_state_fk" FOREIGN KEY ("municipality_id","state_id") REFERENCES "public"."municipalities"("id","state_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint

-- districts (id, municipality_id)
-- NOTE the column-specific SET NULL: deleting a district nulls only
-- district_id, leaving municipality_id intact. A plain ON DELETE SET NULL would
-- null both and silently change delete behaviour. Drizzle cannot emit this form,
-- so it is restored by hand.
ALTER TABLE "neighborhoods" DROP CONSTRAINT "neighborhoods_district_municipality_fk";--> statement-breakpoint
DROP INDEX "districts_id_municipality_id_uidx";--> statement-breakpoint
ALTER TABLE "districts" ADD CONSTRAINT "districts_id_municipality_id_uidx" UNIQUE("id","municipality_id");--> statement-breakpoint
ALTER TABLE "neighborhoods" ADD CONSTRAINT "neighborhoods_district_municipality_fk" FOREIGN KEY ("district_id","municipality_id") REFERENCES "public"."districts"("id","municipality_id") ON DELETE SET NULL ("district_id") ON UPDATE no action;--> statement-breakpoint

-- subdistricts (id, district_id)
ALTER TABLE "neighborhoods" DROP CONSTRAINT "neighborhoods_subdistrict_district_fk";--> statement-breakpoint
DROP INDEX "subdistricts_id_district_id_uidx";--> statement-breakpoint
ALTER TABLE "subdistricts" ADD CONSTRAINT "subdistricts_id_district_id_uidx" UNIQUE("id","district_id");--> statement-breakpoint
ALTER TABLE "neighborhoods" ADD CONSTRAINT "neighborhoods_subdistrict_district_fk" FOREIGN KEY ("subdistrict_id","district_id") REFERENCES "public"."subdistricts"("id","district_id") ON DELETE SET NULL ("subdistrict_id") ON UPDATE no action;--> statement-breakpoint

-- ── 3. The new table ─────────────────────────────────────────────────────────
-- Keyed on the facility *vertical profile*, not the facility: a usage figure is
-- only meaningful inside one linha. `product_ownership` is a generated column
-- pinned to COMPETITOR so the composite FK to products (id, ownership) makes it
-- impossible to record one of our own products as competitor usage.
CREATE TABLE "facility_product_usage" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "facility_product_usage_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"facility_vertical_profile_id" bigint NOT NULL,
	"definition_id" bigint NOT NULL,
	"vertical_id" bigint NOT NULL,
	"product_id" bigint NOT NULL,
	"product_ownership" "product_ownership" GENERATED ALWAYS AS ('COMPETITOR'::product_ownership) STORED NOT NULL,
	"quantity" numeric(14, 2) NOT NULL,
	"updated_by_user_id" bigint,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "facility_product_usage_profile_definition_product_key" UNIQUE("facility_vertical_profile_id","definition_id","product_id"),
	CONSTRAINT "facility_product_usage_quantity_non_negative" CHECK ("facility_product_usage"."quantity" >= 0)
);
--> statement-breakpoint
ALTER TABLE "facility_product_usage" ADD CONSTRAINT "facility_product_usage_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_product_usage" ADD CONSTRAINT "facility_product_usage_profile_vertical_fk" FOREIGN KEY ("facility_vertical_profile_id","vertical_id") REFERENCES "public"."facility_vertical_profiles"("id","vertical_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_product_usage" ADD CONSTRAINT "facility_product_usage_definition_vertical_fk" FOREIGN KEY ("definition_id","vertical_id") REFERENCES "public"."product_potential_definitions"("id","vertical_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_product_usage" ADD CONSTRAINT "facility_product_usage_competitor_fk" FOREIGN KEY ("product_id","product_ownership") REFERENCES "public"."products"("id","ownership") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "facility_product_usage_profile_idx" ON "facility_product_usage" USING btree ("facility_vertical_profile_id");--> statement-breakpoint
CREATE INDEX "facility_product_usage_definition_idx" ON "facility_product_usage" USING btree ("definition_id");--> statement-breakpoint
CREATE INDEX "facility_product_usage_product_idx" ON "facility_product_usage" USING btree ("product_id");
