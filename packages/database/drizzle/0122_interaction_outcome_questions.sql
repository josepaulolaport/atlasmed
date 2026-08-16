CREATE TYPE "public"."interaction_follow_up" AS ENUM('NENHUM', 'DIAS_15', 'DIAS_30', 'DIAS_90');--> statement-breakpoint
CREATE TYPE "public"."interaction_outcome" AS ENUM('PEDIDO', 'VAI_AVALIAR', 'RELACIONAMENTO', 'NAO_FALEI_COM_NINGUEM');--> statement-breakpoint
ALTER TABLE "interactions" ADD COLUMN "outcome" "interaction_outcome";--> statement-breakpoint
ALTER TABLE "interactions" ADD COLUMN "follow_up" "interaction_follow_up";--> statement-breakpoint
ALTER TABLE "interactions" ADD COLUMN "outcome_answered_at" timestamp with time zone;