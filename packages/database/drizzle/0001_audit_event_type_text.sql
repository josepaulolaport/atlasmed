ALTER TABLE "audit"."audit_logs" ALTER COLUMN "event_type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "audit"."audit_event_type";