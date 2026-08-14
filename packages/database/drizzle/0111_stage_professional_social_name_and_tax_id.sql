-- Two columns `registry.professionals` has always carried.
--
-- Spec 0015 §6.7 moved the loader's professional read from the archive to
-- `ingestion.professional_staging`. Staging held only the name and CNS, so that
-- move would have silently stopped populating `social_name` and `tax_id` — a
-- behaviour change smuggled in under a performance one.
--
-- `tax_id` is masked in the public dump (`XXX.392.286.XX`, 5 of 11 digits
-- redacted, on 100 % of rows) and matches nobody. It is staged only so the
-- derived table keeps the column it has, not because anything can use it.

ALTER TABLE "ingestion"."professional_staging" ADD COLUMN "social_name" text;--> statement-breakpoint
ALTER TABLE "ingestion"."professional_staging" ADD COLUMN "tax_id" text;
