CREATE TABLE "healthcare_specialties" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "healthcare_specialties_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"cnes_id" bigint NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "healthcare_specialties_cnes_id_key" UNIQUE("cnes_id")
);
--> statement-breakpoint
CREATE TABLE "person_facilities" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "person_facilities_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"person_id" bigint NOT NULL,
	"facility_id" bigint NOT NULL,
	"role_title" text,
	"notes" text,
	"confirmed_at" timestamp,
	"confirmed_by_user_id" bigint,
	"ended_at" timestamp,
	"ended_by_user_id" bigint,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "person_facilities_ended_pair_check" CHECK (("person_facilities"."ended_at" IS NULL) = ("person_facilities"."ended_by_user_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "person_facility_classification_assignments" (
	"person_facility_id" bigint NOT NULL,
	"classification_code" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "person_facility_classification_assignments_pkey" PRIMARY KEY("person_facility_id","classification_code")
);
--> statement-breakpoint
CREATE TABLE "person_facility_classifications" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "person_facility_occupations" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "person_facility_occupations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"person_facility_id" bigint NOT NULL,
	"occupation_id" bigint NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "person_facility_occupations_person_facility_occupation_key" UNIQUE("person_facility_id","occupation_id")
);
--> statement-breakpoint
CREATE TABLE "person_facility_role_assignments" (
	"person_facility_id" bigint NOT NULL,
	"role_code" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "person_facility_role_assignments_pkey" PRIMARY KEY("person_facility_id","role_code")
);
--> statement-breakpoint
CREATE TABLE "person_facility_roles" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "person_healthcare_profile_specialties" (
	"person_id" bigint NOT NULL,
	"specialty_id" bigint NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "person_healthcare_profile_specialties_pkey" PRIMARY KEY("person_id","specialty_id")
);
--> statement-breakpoint
CREATE TABLE "person_healthcare_profiles" (
	"person_id" bigint PRIMARY KEY NOT NULL,
	"cnes_professional_id" bigint,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "person_notes" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "person_notes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" bigint NOT NULL,
	"person_id" bigint NOT NULL,
	"note" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "person_professional_registration_councils" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "person_professional_registration_types" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "person_professional_registrations" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "person_professional_registrations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"person_id" bigint NOT NULL,
	"council_code" text NOT NULL,
	"state_code" char(2) NOT NULL,
	"registration_number" text NOT NULL,
	"registration_type_code" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "person_professional_registrations_council_state_number_key" UNIQUE("council_code","state_code","registration_number")
);
--> statement-breakpoint
CREATE TABLE "persons" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "persons_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"social_name" text,
	"cpf" char(11),
	"birth_date" date,
	"mobile_phone" text,
	"landline_phone" text,
	"email" text,
	"website_url" text,
	"image_url" text,
	"image_blurhash" text,
	"favorite_team" text,
	"favorite_sport" text,
	"languages" text,
	"hobbies" text,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "persons_cpf_digits_check" CHECK ("persons"."cpf" IS NULL OR "persons"."cpf" ~ '^[0-9]{11}$')
);
--> statement-breakpoint
CREATE TABLE "user_person_relationships" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_person_relationships_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" bigint NOT NULL,
	"person_id" bigint NOT NULL,
	"relationship_level" smallint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_person_relationships_user_id_person_id_key" UNIQUE("user_id","person_id"),
	CONSTRAINT "user_person_relationships_level_check" CHECK ("user_person_relationships"."relationship_level" >= 1 AND "user_person_relationships"."relationship_level" <= 10)
);
--> statement-breakpoint
ALTER TABLE "facility_professionals" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "facility_representatives" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "professional_notes" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "professionals" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_professional_relationships" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_representative_relationships" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "facility_professionals" CASCADE;--> statement-breakpoint
DROP TABLE "facility_representatives" CASCADE;--> statement-breakpoint
DROP TABLE "professional_notes" CASCADE;--> statement-breakpoint
DROP TABLE "professionals" CASCADE;--> statement-breakpoint
DROP TABLE "user_professional_relationships" CASCADE;--> statement-breakpoint
DROP TABLE "user_representative_relationships" CASCADE;--> statement-breakpoint
ALTER TABLE "field_suggestions" DROP CONSTRAINT IF EXISTS "field_suggestions_professional_id_professionals_id_fk";--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_professional_id_professionals_id_fk";--> statement-breakpoint
DROP INDEX IF EXISTS "orders_professional_id_idx";--> statement-breakpoint
ALTER TABLE "field_suggestions" RENAME COLUMN "professional_id" TO "person_id";--> statement-breakpoint
ALTER TABLE "orders" RENAME COLUMN "professional_id" TO "person_id";--> statement-breakpoint
DROP TABLE IF EXISTS "occupations" CASCADE;--> statement-breakpoint
CREATE TABLE "occupations" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "occupations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"cnes_id" text NOT NULL,
	"name" text NOT NULL,
	"is_health_occupation" boolean,
	"is_regulated" boolean,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "occupations_cnes_id_key" UNIQUE("cnes_id")
);--> statement-breakpoint
ALTER TABLE "person_facilities" ADD CONSTRAINT "person_facilities_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_facilities" ADD CONSTRAINT "person_facilities_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_facilities" ADD CONSTRAINT "person_facilities_confirmed_by_user_id_users_id_fk" FOREIGN KEY ("confirmed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_facilities" ADD CONSTRAINT "person_facilities_ended_by_user_id_users_id_fk" FOREIGN KEY ("ended_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_facility_classification_assignments" ADD CONSTRAINT "person_facility_classification_assignments_person_facility_id_person_facilities_id_fk" FOREIGN KEY ("person_facility_id") REFERENCES "public"."person_facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_facility_classification_assignments" ADD CONSTRAINT "person_facility_classification_assignments_classification_code_person_facility_classifications_code_fk" FOREIGN KEY ("classification_code") REFERENCES "public"."person_facility_classifications"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_facility_occupations" ADD CONSTRAINT "person_facility_occupations_person_facility_id_person_facilities_id_fk" FOREIGN KEY ("person_facility_id") REFERENCES "public"."person_facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_facility_occupations" ADD CONSTRAINT "person_facility_occupations_occupation_id_occupations_id_fk" FOREIGN KEY ("occupation_id") REFERENCES "public"."occupations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_facility_role_assignments" ADD CONSTRAINT "person_facility_role_assignments_person_facility_id_person_facilities_id_fk" FOREIGN KEY ("person_facility_id") REFERENCES "public"."person_facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_facility_role_assignments" ADD CONSTRAINT "person_facility_role_assignments_role_code_person_facility_roles_code_fk" FOREIGN KEY ("role_code") REFERENCES "public"."person_facility_roles"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_healthcare_profile_specialties" ADD CONSTRAINT "person_healthcare_profile_specialties_person_id_person_healthcare_profiles_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person_healthcare_profiles"("person_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_healthcare_profile_specialties" ADD CONSTRAINT "person_healthcare_profile_specialties_specialty_id_healthcare_specialties_id_fk" FOREIGN KEY ("specialty_id") REFERENCES "public"."healthcare_specialties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_healthcare_profiles" ADD CONSTRAINT "person_healthcare_profiles_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_notes" ADD CONSTRAINT "person_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_notes" ADD CONSTRAINT "person_notes_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_professional_registrations" ADD CONSTRAINT "person_professional_registrations_person_id_person_healthcare_profiles_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person_healthcare_profiles"("person_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_professional_registrations" ADD CONSTRAINT "person_professional_registrations_council_code_person_professional_registration_councils_code_fk" FOREIGN KEY ("council_code") REFERENCES "public"."person_professional_registration_councils"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_professional_registrations" ADD CONSTRAINT "person_professional_registrations_registration_type_code_person_professional_registration_types_code_fk" FOREIGN KEY ("registration_type_code") REFERENCES "public"."person_professional_registration_types"("code") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_person_relationships" ADD CONSTRAINT "user_person_relationships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_person_relationships" ADD CONSTRAINT "user_person_relationships_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "person_facilities_person_id_idx" ON "person_facilities" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "person_facilities_facility_id_idx" ON "person_facilities" USING btree ("facility_id");--> statement-breakpoint
CREATE UNIQUE INDEX "person_facilities_active_facility_person_uidx" ON "person_facilities" USING btree ("facility_id","person_id") WHERE "person_facilities"."ended_at" IS NULL;--> statement-breakpoint
CREATE INDEX "person_facility_occupations_person_facility_id_idx" ON "person_facility_occupations" USING btree ("person_facility_id");--> statement-breakpoint
CREATE INDEX "person_facility_occupations_occupation_id_idx" ON "person_facility_occupations" USING btree ("occupation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "person_healthcare_profile_specialties_primary_uidx" ON "person_healthcare_profile_specialties" USING btree ("person_id") WHERE "person_healthcare_profile_specialties"."is_primary";--> statement-breakpoint
CREATE UNIQUE INDEX "person_healthcare_profiles_cnes_professional_id_uidx" ON "person_healthcare_profiles" USING btree ("cnes_professional_id") WHERE "person_healthcare_profiles"."cnes_professional_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "person_notes_person_id_user_id_created_at_idx" ON "person_notes" USING btree ("person_id","user_id","created_at");--> statement-breakpoint
CREATE INDEX "person_notes_user_id_created_at_idx" ON "person_notes" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "person_professional_registrations_person_id_idx" ON "person_professional_registrations" USING btree ("person_id");--> statement-breakpoint
CREATE UNIQUE INDEX "person_professional_registrations_primary_uidx" ON "person_professional_registrations" USING btree ("person_id") WHERE "person_professional_registrations"."is_primary";--> statement-breakpoint
CREATE INDEX "persons_last_name_first_name_idx" ON "persons" USING btree ("last_name","first_name");--> statement-breakpoint
CREATE INDEX "persons_deleted_at_idx" ON "persons" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "persons_mobile_phone_idx" ON "persons" USING btree ("mobile_phone");--> statement-breakpoint
CREATE INDEX "persons_email_idx" ON "persons" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "persons_cpf_active_uidx" ON "persons" USING btree ("cpf") WHERE "persons"."cpf" IS NOT NULL AND "persons"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "user_person_relationships_person_id_idx" ON "user_person_relationships" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "user_person_relationships_user_id_idx" ON "user_person_relationships" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "field_suggestions" ADD CONSTRAINT "field_suggestions_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "orders_person_id_idx" ON "orders" USING btree ("person_id");--> statement-breakpoint
ALTER TABLE "facility_consultant_assignments" ADD CONSTRAINT "facility_consultant_assignments_ended_at_gte_started_at_check" CHECK ("facility_consultant_assignments"."ended_at" IS NULL OR "facility_consultant_assignments"."ended_at" >= "facility_consultant_assignments"."started_at");--> statement-breakpoint
DROP TYPE IF EXISTS "public"."contact_type";
