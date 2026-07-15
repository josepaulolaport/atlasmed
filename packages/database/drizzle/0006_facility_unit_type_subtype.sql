ALTER TABLE "facilities" ADD COLUMN IF NOT EXISTS "unit_type" text;--> statement-breakpoint
ALTER TABLE "facilities" ADD COLUMN IF NOT EXISTS "unit_subtype" text;
