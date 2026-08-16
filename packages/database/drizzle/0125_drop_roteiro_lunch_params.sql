ALTER TABLE "roteiro_params" DROP CONSTRAINT "roteiro_params_lunch_minutes_non_negative_check";--> statement-breakpoint
ALTER TABLE "roteiro_params" DROP COLUMN "lunch_start";--> statement-breakpoint
ALTER TABLE "roteiro_params" DROP COLUMN "lunch_minutes";