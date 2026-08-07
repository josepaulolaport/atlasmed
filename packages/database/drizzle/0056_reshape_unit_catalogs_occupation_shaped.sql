CREATE TABLE "unit_subtypes" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "unit_subtypes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"unit_type_id" bigint NOT NULL,
	"cnes_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unit_subtypes_unit_type_id_cnes_id_key" UNIQUE("unit_type_id","cnes_id")
);
--> statement-breakpoint
CREATE TABLE "unit_types" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "unit_types_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"cnes_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unit_types_cnes_id_key" UNIQUE("cnes_id")
);
--> statement-breakpoint
ALTER TABLE "facilities" ADD COLUMN "unit_type_id" bigint;--> statement-breakpoint
ALTER TABLE "facilities" ADD COLUMN "unit_subtype_id" bigint;--> statement-breakpoint
ALTER TABLE "unit_subtypes" ADD CONSTRAINT "unit_subtypes_unit_type_id_unit_types_id_fk" FOREIGN KEY ("unit_type_id") REFERENCES "public"."unit_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_unit_type_id_unit_types_id_fk" FOREIGN KEY ("unit_type_id") REFERENCES "public"."unit_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_unit_subtype_id_unit_subtypes_id_fk" FOREIGN KEY ("unit_subtype_id") REFERENCES "public"."unit_subtypes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "facilities_unit_type_id_idx" ON "facilities" USING btree ("unit_type_id") WHERE "facilities"."unit_type_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "facilities_unit_subtype_id_idx" ON "facilities" USING btree ("unit_subtype_id") WHERE "facilities"."unit_subtype_id" IS NOT NULL;