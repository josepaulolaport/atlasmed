-- Schema/DB reconciliation migration.
-- The DB was partially managed outside of Drizzle migrations.
-- All statements use IF NOT EXISTS so they are safe to run on both
-- databases that already have the columns and clean databases that don't.

-- orders: add columns present in DB but missing from prior schema
ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "seller_id" text,
  ADD COLUMN IF NOT EXISTS "professional_id" text,
  ADD COLUMN IF NOT EXISTS "surgery_type" text,
  ADD COLUMN IF NOT EXISTS "surgery_subtype" text,
  ADD COLUMN IF NOT EXISTS "ordered_at" timestamp,
  ADD COLUMN IF NOT EXISTS "freight" numeric(15,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "gross_weight" numeric(15,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "net_weight" numeric(15,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "currency" text NOT NULL DEFAULT 'BRL',
  ADD COLUMN IF NOT EXISTS "usd_exchange_rate" numeric(15,4),
  ADD COLUMN IF NOT EXISTS "finalized_by_id" text,
  ADD COLUMN IF NOT EXISTS "finalized_at" timestamp,
  ADD COLUMN IF NOT EXISTS "rejected_by_id" text,
  ADD COLUMN IF NOT EXISTS "rejection_reason" text,
  ADD COLUMN IF NOT EXISTS "no_billing_by_id" text,
  ADD COLUMN IF NOT EXISTS "no_billing_at" timestamp,
  ADD COLUMN IF NOT EXISTS "no_billing_notes" text,
  ADD COLUMN IF NOT EXISTS "expense_authorized_by_id" text,
  ADD COLUMN IF NOT EXISTS "expense_authorized_at" timestamp;--> statement-breakpoint

-- order_items: add columns present in DB but missing from prior schema
ALTER TABLE "order_items"
  ADD COLUMN IF NOT EXISTS "legacy_id" integer,
  ADD COLUMN IF NOT EXISTS "line_number" integer,
  ADD COLUMN IF NOT EXISTS "usd_price" numeric(15,4),
  ADD COLUMN IF NOT EXISTS "batch_number" text,
  ADD COLUMN IF NOT EXISTS "written_off" boolean NOT NULL DEFAULT false;--> statement-breakpoint

-- competitor_products: add legacy_id present in DB but missing from prior schema
ALTER TABLE "competitor_products"
  ADD COLUMN IF NOT EXISTS "legacy_id" integer;
