CREATE TABLE "person_professional_registration_councils" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "person_professional_registration_councils_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"abbreviation" text NOT NULL,
	"cnes_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "person_professional_registration_councils_abbreviation_unique" UNIQUE("abbreviation"),
	CONSTRAINT "person_professional_registration_councils_cnes_id_unique" UNIQUE("cnes_id")
);
--> statement-breakpoint
CREATE TABLE "person_professional_registrations" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "person_professional_registrations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"person_id" bigint NOT NULL,
	"council_id" bigint NOT NULL,
	"state_code" char(2) NOT NULL,
	"registration_number" text NOT NULL,
	"registration_type_code" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "person_professional_registrations_council_state_number_key" UNIQUE("council_id","state_code","registration_number")
);
--> statement-breakpoint
ALTER TABLE "person_professional_registrations" ADD CONSTRAINT "person_professional_registrations_person_id_person_healthcare_profiles_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person_healthcare_profiles"("person_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_professional_registrations" ADD CONSTRAINT "person_professional_registrations_council_id_person_professional_registration_councils_id_fk" FOREIGN KEY ("council_id") REFERENCES "public"."person_professional_registration_councils"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_professional_registrations" ADD CONSTRAINT "person_professional_registrations_registration_type_code_person_professional_registration_types_code_fk" FOREIGN KEY ("registration_type_code") REFERENCES "public"."person_professional_registration_types"("code") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "person_professional_registrations_person_id_idx" ON "person_professional_registrations" USING btree ("person_id");--> statement-breakpoint
CREATE UNIQUE INDEX "person_professional_registrations_primary_uidx" ON "person_professional_registrations" USING btree ("person_id") WHERE "person_professional_registrations"."is_primary";