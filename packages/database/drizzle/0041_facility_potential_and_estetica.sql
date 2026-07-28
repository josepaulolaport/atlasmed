CREATE TABLE "facility_potential_values" (
	"facility_id" text NOT NULL,
	"definition_id" text NOT NULL,
	"quantity" numeric(14, 2) NOT NULL,
	"updated_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "facility_potential_values_pk" UNIQUE("facility_id","definition_id")
);
--> statement-breakpoint
CREATE TABLE "potential_metric_definitions" (
	"id" text PRIMARY KEY NOT NULL,
	"vertical_id" text NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_potential_links" (
	"product_id" text PRIMARY KEY NOT NULL,
	"definition_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "facility_potential_values" ADD CONSTRAINT "facility_potential_values_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_potential_values" ADD CONSTRAINT "facility_potential_values_definition_id_potential_metric_definitions_id_fk" FOREIGN KEY ("definition_id") REFERENCES "public"."potential_metric_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_potential_values" ADD CONSTRAINT "facility_potential_values_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "potential_metric_definitions" ADD CONSTRAINT "potential_metric_definitions_vertical_id_business_verticals_id_fk" FOREIGN KEY ("vertical_id") REFERENCES "public"."business_verticals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_potential_links" ADD CONSTRAINT "product_potential_links_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_potential_links" ADD CONSTRAINT "product_potential_links_definition_id_potential_metric_definitions_id_fk" FOREIGN KEY ("definition_id") REFERENCES "public"."potential_metric_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "facility_potential_values_facility_id_idx" ON "facility_potential_values" USING btree ("facility_id");--> statement-breakpoint
CREATE INDEX "facility_potential_values_definition_id_idx" ON "facility_potential_values" USING btree ("definition_id");--> statement-breakpoint
CREATE INDEX "potential_metric_definitions_vertical_id_idx" ON "potential_metric_definitions" USING btree ("vertical_id");--> statement-breakpoint
CREATE UNIQUE INDEX "potential_metric_definitions_vertical_key_active_uidx" ON "potential_metric_definitions" USING btree ("vertical_id","key") WHERE "potential_metric_definitions"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "product_potential_links_definition_id_idx" ON "product_potential_links" USING btree ("definition_id");
--> statement-breakpoint
-- Linha comercial display: Dermatológica → Estética (code DERMATOLOGIA unchanged).
UPDATE "business_verticals"
SET "name" = 'Estética', "updated_at" = NOW()
WHERE "code" = 'DERMATOLOGIA' AND "name" <> 'Estética';