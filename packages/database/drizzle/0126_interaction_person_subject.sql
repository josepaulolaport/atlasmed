ALTER TABLE "interactions" ALTER COLUMN "facility_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "interactions" ADD COLUMN "person_id" bigint;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "interactions_person_id_status_idx" ON "interactions" USING btree ("person_id","status");--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_subject_check" CHECK ("interactions"."facility_id" is not null or "interactions"."person_id" is not null);--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_in_person_has_facility_check" CHECK ("interactions"."modality" <> 'IN_PERSON' or "interactions"."facility_id" is not null);