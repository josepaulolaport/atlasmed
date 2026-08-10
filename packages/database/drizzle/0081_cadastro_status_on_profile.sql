-- Spec 0010 §1.6 / §5.2 — cadastro status moves to the profile, and only there.
--
-- Two things happen here, and both are deliberate data changes rather than pure
-- schema moves.
--
-- 1. `facilities.conformity_status` is REMOVED. A single facility-wide verdict
--    across verticals that require different documents cannot be meaningful, and
--    it was written in lockstep with the profile column below — the same fact
--    stored twice, in two different vocabularies. The profile is now the only
--    record.
--
-- 2. `facility_vertical_profiles.commercial_status` becomes `conformity_status`.
--    The values were always cadastro completion, never commercial state; only
--    the name was wrong. The enum name `conformity_status` is freed by (1) and
--    reused here, so the type is dropped and recreated with the profile's value
--    set (UNREGISTERED / REGISTERED / SUSPENDED / CLOSED).
--
-- **Every profile is reset to UNREGISTERED, and that is intentional (user
-- decision, 2026-08-10).** Production held 760 REGISTERED, 664 UNREGISTERED and
-- 19 CLOSED, but none of the non-default values can have been earned:
-- `conformity_requirements` is empty in production, and
-- FacilityCadastroCompletionService requires `requirements.length > 0` before it
-- will write REGISTERED. Those values predate 0046 truncating the requirements
-- and have been stale ever since — a clinic reading "Operante" to a rep on the
-- strength of documents the system no longer has.
--
-- Implemented as drop + recreate rather than ALTER ... RENAME precisely because
-- the reset is wanted. A rename would carry the stale values forward. The old
-- values are recoverable from the 2026-08-10T10:47Z dump if this proves wrong.
--
-- Statement order matters and differs from `drizzle-kit generate` output: the
-- generated form dropped the `conformity_status` type before dropping the column
-- that used it, which Postgres refuses. Columns and indexes go first, then the
-- types, then the new type and column.

DROP INDEX IF EXISTS "facilities_conformity_status_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "facility_vertical_profiles_commercial_status_idx";--> statement-breakpoint

ALTER TABLE "facilities" DROP COLUMN IF EXISTS "conformity_status";--> statement-breakpoint
ALTER TABLE "facility_vertical_profiles" DROP COLUMN IF EXISTS "commercial_status";--> statement-breakpoint

DROP TYPE IF EXISTS "public"."conformity_status";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."commercial_status";--> statement-breakpoint

CREATE TYPE "public"."conformity_status" AS ENUM('UNREGISTERED', 'REGISTERED', 'SUSPENDED', 'CLOSED');--> statement-breakpoint

ALTER TABLE "facility_vertical_profiles" ADD COLUMN "conformity_status" "conformity_status" DEFAULT 'UNREGISTERED' NOT NULL;--> statement-breakpoint
CREATE INDEX "facility_vertical_profiles_conformity_status_idx" ON "facility_vertical_profiles" USING btree ("conformity_status");
