CREATE TYPE "public"."interaction_duration_source" AS ENUM('MEASURED', 'INFERRED');--> statement-breakpoint
ALTER TABLE "interactions" ADD COLUMN "duration_source" "interaction_duration_source";