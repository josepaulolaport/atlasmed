CREATE TABLE "user_facility_bookmarks" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_facility_bookmarks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" bigint NOT NULL,
	"facility_id" bigint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_person_bookmarks" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_person_bookmarks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" bigint NOT NULL,
	"person_id" bigint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_facility_bookmarks" ADD CONSTRAINT "user_facility_bookmarks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_facility_bookmarks" ADD CONSTRAINT "user_facility_bookmarks_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_person_bookmarks" ADD CONSTRAINT "user_person_bookmarks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_person_bookmarks" ADD CONSTRAINT "user_person_bookmarks_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_facility_bookmarks_user_id_facility_id_uidx" ON "user_facility_bookmarks" USING btree ("user_id","facility_id");--> statement-breakpoint
CREATE INDEX "user_facility_bookmarks_user_id_created_at_idx" ON "user_facility_bookmarks" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "user_facility_bookmarks_facility_id_idx" ON "user_facility_bookmarks" USING btree ("facility_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_person_bookmarks_user_id_person_id_uidx" ON "user_person_bookmarks" USING btree ("user_id","person_id");--> statement-breakpoint
CREATE INDEX "user_person_bookmarks_user_id_created_at_idx" ON "user_person_bookmarks" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "user_person_bookmarks_person_id_idx" ON "user_person_bookmarks" USING btree ("person_id");