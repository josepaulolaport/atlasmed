CREATE TABLE "person_facility_role_assignments" (
	"person_facility_id" bigint NOT NULL,
	"role_id" bigint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "person_facility_role_assignments_pkey" PRIMARY KEY("person_facility_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "person_facility_roles" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "person_facility_roles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "person_facility_role_assignments" ADD CONSTRAINT "person_facility_role_assignments_person_facility_id_person_facilities_id_fk" FOREIGN KEY ("person_facility_id") REFERENCES "public"."person_facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_facility_role_assignments" ADD CONSTRAINT "person_facility_role_assignments_role_id_person_facility_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."person_facility_roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "person_facility_roles_name_normalized_uidx" ON "person_facility_roles" USING btree (lower(trim("name")));