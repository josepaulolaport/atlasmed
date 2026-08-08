-- IBGE admin geography: ibge_code→ibge_id; districts/subdistricts; neighborhood FKs.
-- Custom SQL (safe renames + composite SET NULL column lists). Facilities.neighborhood stays free text.

-- ========== 1) Rename ibge_code → ibge_id ==========
ALTER TABLE "states" RENAME COLUMN "ibge_code" TO "ibge_id";--> statement-breakpoint
ALTER INDEX "states_ibge_code_uidx" RENAME TO "states_ibge_id_uidx";--> statement-breakpoint

ALTER TABLE "municipalities" RENAME COLUMN "ibge_code" TO "ibge_id";--> statement-breakpoint
ALTER INDEX "municipalities_ibge_code_uidx" RENAME TO "municipalities_ibge_id_uidx";--> statement-breakpoint

ALTER TABLE "neighborhoods" RENAME COLUMN "ibge_code" TO "ibge_id";--> statement-breakpoint
ALTER INDEX "neighborhoods_ibge_code_uidx" RENAME TO "neighborhoods_ibge_id_uidx";--> statement-breakpoint

-- ========== 2) districts ==========
CREATE TABLE "districts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "districts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"municipality_id" integer NOT NULL,
	"name" text NOT NULL,
	"ibge_id" text NOT NULL,
	"boundary" geometry(MultiPolygon, 4326),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "districts" ADD CONSTRAINT "districts_municipality_id_municipalities_id_fk" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipalities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "districts_ibge_id_uidx" ON "districts" USING btree ("ibge_id");--> statement-breakpoint
CREATE UNIQUE INDEX "districts_id_municipality_id_uidx" ON "districts" USING btree ("id","municipality_id");--> statement-breakpoint
CREATE INDEX "districts_municipality_id_idx" ON "districts" USING btree ("municipality_id");--> statement-breakpoint
CREATE INDEX "districts_name_idx" ON "districts" USING btree ("name");--> statement-breakpoint
CREATE INDEX "districts_boundary_gist_idx" ON "districts" USING gist ("boundary") WHERE "boundary" IS NOT NULL;--> statement-breakpoint

-- ========== 3) subdistricts ==========
CREATE TABLE "subdistricts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "subdistricts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"district_id" integer NOT NULL,
	"name" text NOT NULL,
	"ibge_id" text NOT NULL,
	"boundary" geometry(MultiPolygon, 4326),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "subdistricts" ADD CONSTRAINT "subdistricts_district_id_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."districts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "subdistricts_ibge_id_uidx" ON "subdistricts" USING btree ("ibge_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subdistricts_id_district_id_uidx" ON "subdistricts" USING btree ("id","district_id");--> statement-breakpoint
CREATE INDEX "subdistricts_district_id_idx" ON "subdistricts" USING btree ("district_id");--> statement-breakpoint
CREATE INDEX "subdistricts_name_idx" ON "subdistricts" USING btree ("name");--> statement-breakpoint
CREATE INDEX "subdistricts_boundary_gist_idx" ON "subdistricts" USING gist ("boundary") WHERE "boundary" IS NOT NULL;--> statement-breakpoint

-- ========== 4) neighborhoods FKs ==========
ALTER TABLE "neighborhoods" ADD COLUMN "district_id" integer;--> statement-breakpoint
ALTER TABLE "neighborhoods" ADD COLUMN "subdistrict_id" integer;--> statement-breakpoint
-- Composite FKs: SET NULL only the geo child column (PG15+), keep municipality_id.
ALTER TABLE "neighborhoods" ADD CONSTRAINT "neighborhoods_district_municipality_fk" FOREIGN KEY ("district_id","municipality_id") REFERENCES "public"."districts"("id","municipality_id") ON DELETE SET NULL ("district_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "neighborhoods" ADD CONSTRAINT "neighborhoods_subdistrict_district_fk" FOREIGN KEY ("subdistrict_id","district_id") REFERENCES "public"."subdistricts"("id","district_id") ON DELETE SET NULL ("subdistrict_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "neighborhoods" ADD CONSTRAINT "neighborhoods_subdistrict_requires_district" CHECK ("subdistrict_id" IS NULL OR "district_id" IS NOT NULL);--> statement-breakpoint
CREATE INDEX "neighborhoods_district_id_idx" ON "neighborhoods" USING btree ("district_id");--> statement-breakpoint
CREATE INDEX "neighborhoods_subdistrict_id_idx" ON "neighborhoods" USING btree ("subdistrict_id");
